/* HELIOS IDLE — coordenação entre abas e gravação segura (sem DOM; testável no Node).

   Regras:
   - Só a aba "gravadora" (writer) simula e grava. As outras ficam em modo de leitura.
   - A posse é um aluguel no armazenamento ({id, t}) renovado a cada 2s. Se a aba gravadora fechar,
     o aluguel é liberado; se ela travar, o aluguel expira em `ttl` ms e outra aba pode assumir.
   - Toda gravação leva uma revisão (rev). Antes de gravar, a aba confere a revisão guardada: se for
     maior que a sua, outra aba gravou depois dela e esta aba fica desatualizada (não grava mais).
   - Assumir a sessão: a aba pede a liberação; a gravadora salva, libera e vira leitura. Se ela não
     responder, a posse é tomada mesmo assim e a antiga para de gravar ao perceber.
*/
(function (H) {
  'use strict';
  const E = H.E;
  const randId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

  // Acesso seguro ao armazenamento: o próprio acesso ao localStorage pode lançar exceção.
  H.safeStorage = function (getStore) {
    const g = () => { try { return getStore(); } catch (e) { return null; } };
    return {
      available() { const s = g(); if (!s) return false; try { s.setItem('__helios_t', '1'); s.removeItem('__helios_t'); return true; } catch (e) { return false; } },
      getItem(k) { const s = g(); if (!s) return null; try { return s.getItem(k); } catch (e) { return null; } },
      setItem(k, v) { const s = g(); if (!s) { const e = new Error('Armazenamento indisponível'); e.name = 'SecurityError'; throw e; } s.setItem(k, v); },
      removeItem(k) { const s = g(); if (!s) return; try { s.removeItem(k); } catch (e) { /* ignora */ } },
    };
  };
  H.storageErrorKind = function (e) {
    if (!e) return 'blocked';
    const n = e.name || ''; const c = e.code;
    if (n === 'QuotaExceededError' || n === 'NS_ERROR_DOM_QUOTA_REACHED' || c === 22 || c === 1014) return 'quota';
    return 'blocked';
  };

  H.makeSession = function (o) {
    const st = o.storage; const now = o.now || Date.now; const TTL = o.ttl || 6000;
    const keys = { save: o.key, lock: o.key + '_lock', req: o.key + '_req' };
    const me = { id: o.id || randId(), role: 'passive', rev: -1, keys, lost: null, protect: false };
    const readLock = () => { try { const v = JSON.parse(st.getItem(keys.lock) || 'null'); return v && typeof v.id === 'string' && typeof v.t === 'number' ? v : null; } catch (e) { return null; } };
    const writeLock = () => { try { st.setItem(keys.lock, JSON.stringify({ id: me.id, t: now() })); return true; } catch (e) { return false; } };
    me.lockState = function () {
      const l = readLock(); if (!l) return 'free';
      if (l.id === me.id) return 'mine';
      return now() - l.t > TTL ? 'stale' : 'other';
    };
    me.storedRev = () => E.peekRev(st.getItem(keys.save));
    me.readRaw = () => st.getItem(keys.save);
    // tenta tornar-se a aba gravadora; force = tomar a posse de outra aba
    me.claim = function (force) {
      const s = me.lockState();
      if (s === 'other' && !force) return false;
      if (!writeLock()) { me.role = 'writer'; me.noLock = true; return true; } // sem armazenamento: aba única possível
      if (readLock() && readLock().id !== me.id) return false;
      me.role = 'writer'; me.lost = null; me.noLock = false;
      return true;
    };
    me.confirm = function () { // segunda verificação após um instante (corrida entre abas que abrem juntas)
      if (me.role !== 'writer' || me.noLock) return me.role === 'writer';
      const l = readLock(); if (l && l.id !== me.id) { me.lose('taken'); return false; }
      return true;
    };
    me.heartbeat = function () {
      if (me.role !== 'writer' || me.noLock) return;
      const l = readLock();
      if (l && l.id !== me.id && now() - l.t <= TTL) { me.lose('taken'); return; }
      if (me.storedRev() > me.rev) { me.lose('stale'); return; }
      writeLock();
    };
    me.lose = function (why) {
      if (me.role === 'writer' && o.onLost) { me.role = 'passive'; me.lost = why; o.onLost(why); }
      me.role = 'passive'; me.lost = me.lost || why;
    };
    me.release = function () {
      if (me.role === 'writer') { const l = readLock(); if (l && l.id === me.id) st.removeItem(keys.lock); }
      me.role = 'passive';
    };
    // pede à aba gravadora que salve e libere a posse
    me.requestRelease = function () { try { st.setItem(keys.req, JSON.stringify({ id: me.id, t: now() })); } catch (e) { /* ignora */ } };
    me.isReleaseRequest = function (newValue) {
      try { const v = JSON.parse(newValue || 'null'); return !!v && v.id !== me.id && now() - v.t < 10000; } catch (e) { return false; }
    };
    // verificação periódica (caso o evento de armazenamento não chegue): pedido recente de outra aba
    me.pendingRequest = function () { return me.role === 'writer' && !me.noLock && me.isReleaseRequest(st.getItem(keys.req)); };
    me.clearRequest = function () { st.removeItem(keys.req); };
    // grava o estado; devolve { ok, status: 'saved'|'readonly'|'stale'|'error', reason? }
    me.write = function (S) {
      if (me.role !== 'writer') return { ok: false, status: 'readonly' };
      if (!me.noLock) {
        const l = readLock();
        if (l && l.id !== me.id && now() - l.t <= TTL) { me.lose('taken'); return { ok: false, status: 'readonly' }; }
        if (me.storedRev() > me.rev) { me.lose('stale'); return { ok: false, status: 'stale' }; }
      }
      if (me.protect) return { ok: false, status: 'error', reason: 'protected' };
      const prev = S.rev; S.rev = Math.max(me.rev, 0) + 1;
      try { st.setItem(keys.save, E.serialize(S)); } catch (e) { S.rev = prev; return { ok: false, status: 'error', reason: H.storageErrorKind(e) }; }
      me.rev = S.rev;
      if (!me.noLock) writeLock();
      return { ok: true, status: 'saved' };
    };
    return me;
  };
})(typeof window !== 'undefined' ? (window.H = window.H || {}) : (globalThis.H = globalThis.H || {}));
