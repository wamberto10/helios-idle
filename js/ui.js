/* HELIOS IDLE — interface (apresentação). Lê o estado do motor e chama suas ações. */
(function (H) {
  'use strict';
  const { DATA: D, E, F, A } = H;
  const UI = H.UI = {};
  const RO = D.regionOrder;
  let S = null;
  const baseNodes = new Map(), baseScroll = new Map();
  let baseRun = null;
  // painel visual da base (mapa com as instalações): desligado por enquanto; os cartões de instalação continuam
  const SHOW_BASE_PANEL = false;
  const ui = UI.st = { screen: 'region', rid: 'lua', sel: 'lua', rtab: 'prod', resSel: null, uniSel: null, hl: null, sig: '', nodes: [], nr: { from: 'lua', to: '', res: 'metal' }, regFilter: true, modalOpen: false, queue: [] };
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const setT = (el, v) => { if (el._t !== v) { el.textContent = v; el._t = v; } };
  const setH = (el, v) => { if (el._h !== v) { el.innerHTML = v; el._h = v; } };
  const setW = (el, p) => { const v = Math.max(0, Math.min(100, p * 100)).toFixed(1) + '%'; if (el._w !== v) { el.style.width = v; el._w = v; } };
  const setC = (el, c, on) => el.classList.toggle(c, !!on);
  const setD = (el, d) => { if (el.disabled !== !!d) el.disabled = !!d; };
  const sfx = (n) => H.SFX && H.SFX.play(n);
  let profileQueued = false;
  let profileDraft = null;

  // ---------------- PEDAÇOS DE HTML ----------------
  const resChip = (r, amt, have) => `<span class="chip ${have !== undefined && have + 1e-9 < amt ? 'lack' : ''}">${A.rg(r)} ${F.n(amt)}</span>`;
  const costHTML = (cost, reg) => '<span class="costs">' + Object.keys(cost).map((r) => resChip(r, cost[r], reg ? (reg.st[r] || 0) : undefined)).join('') + '</span>';
  function rewardHTML(rw) {
    if (!rw) return '';
    let s = '';
    if (rw.data) s += `<span class="chip cyan">${A.rg('data')} ${F.n(rw.data)} dados</span>`;
    if (rw.frags) s += `<span class="chip purple">${A.rg('frag')} ${rw.frags} fragmento${rw.frags > 1 ? 's' : ''}</span>`;
    if (rw.res) for (const r in rw.res) s += `<span class="chip">${A.rg(r)} ${F.n(rw.res[r])}</span>`;
    if (rw.spec) s += `<span class="chip gold">★ Recruta ${D.specs[rw.spec].name}</span>`;
    if (rw.cards) for (const c in rw.cards) s += `<span class="chip gold">${rw.cards[c]}× carta ${D.specs[c].name}</span>`;
    if (rw.unlock === 'expeditions') s += `<span class="chip ok">Libera expedições</span>`;
    return s;
  }
  const rarColor = (sid) => D.rarities[D.specs[sid].rarity].color;
  const regName = (rid) => rid === 'terra' ? 'Terra' : D.regions[rid].name;

  // ---------------- TOAST / MODAL ----------------
  UI.toast = function (text, kind) {
    const box = $('#toasts'); const el = document.createElement('div');
    el.className = 'toast ' + (kind || ''); el.innerHTML = text; box.prepend(el);
    while (box.children.length > 4) box.lastChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, kind === 'err' ? 2600 : 4800);
  };
  UI.err = (r) => { if (r && !r.ok && r.err) { UI.toast(r.err, 'err'); sfx('err'); } };
  // ---- foco: chave estável para reencontrar um controle depois de re-renderizar ----
  const focusKey = (el) => el && el.nodeType === 1 ? (el.dataset.k ? 'k:' + el.dataset.k : el.dataset.a ? 'a:' + el.dataset.a : el.id ? 'i:' + el.id : null) : null;
  function findKey(root, key) {
    if (!key) return null; const v = key.slice(2); const q = (s) => { try { return root.querySelector(s); } catch (e) { return null; } };
    const esc2 = (s) => (window.CSS && CSS.escape ? CSS.escape(s) : s.replace(/["\\]/g, '\\$&'));
    if (key[0] === 'k') return q(`[data-k="${esc2(v)}"]`);
    if (key[0] === 'a') return q(`[data-a="${esc2(v)}"]`);
    return q('#' + esc2(v));
  }
  const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const focusables = (root) => Array.from(root.querySelectorAll(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement);
  function focusFirst(box) {
    const f = box.querySelector('[autofocus]:not([disabled])') || focusables(box)[0] || box;
    setTimeout(() => { if (box.isConnected) f.focus({ preventScroll: f === box }); }, 30);
  }
  // Modal acessível: foco vai para dentro, fica preso nele (Tab) e volta ao controle de origem ao fechar.
  // opts.live = { sig(), render() }: o conteúdo é refeito sempre que sig() mudar (recursos, níveis, custos).
  UI.modal = function (html, cls, opts) {
    opts = opts || {};
    const m = $('#modal');
    if (!ui.modalOpen && !ui.returnPending) { const ae = document.activeElement; ui.returnFocus = ae && ae !== document.body ? { el: ae, key: focusKey(ae) } : null; }
    ui.returnPending = false;
    m.innerHTML = `<div class="modal ${cls || ''}" role="dialog" aria-modal="true" tabindex="-1">${html}</div>`;
    const box = m.firstChild; labelModal(box);
    m.classList.add('on'); ui.modalOpen = true; ui.modalLock = !!opts.lock;
    ui.modalLive = opts.live || null; ui.modalSig = ui.modalLive ? ui.modalLive.sig() : '';
    ui.mnodes = Array.from(box.querySelectorAll('[data-u]'));
    $('#app').setAttribute('inert', '');
    focusFirst(box);
  };
  function labelModal(box) { const h = box.querySelector('h2'); if (h) { h.id = 'modal-title'; box.setAttribute('aria-labelledby', 'modal-title'); } }
  // refaz um modal "vivo" preservando foco e rolagem
  function refreshModal() {
    const L = ui.modalLive; if (!L || !ui.modalOpen) return;
    const s = L.sig(); if (s === ui.modalSig) return; ui.modalSig = s;
    const box = $('#modal .modal'); if (!box) return;
    const ae = document.activeElement; const key = ae && box.contains(ae) ? focusKey(ae) : null; const top = box.scrollTop;
    box.innerHTML = L.render(); labelModal(box); box.scrollTop = top;
    ui.mnodes = Array.from(box.querySelectorAll('[data-u]'));
    if (key) { const t = findKey(box, key); if (t && !t.disabled) t.focus({ preventScroll: true }); else (focusables(box)[0] || box).focus({ preventScroll: true }); }
  }
  UI.closeModal = function (reset) {
    if (ui.folderCandidate && H.folderSave) { H.folderSave.cancelChoice(); ui.folderCandidate = null; }
    $('#modal').classList.remove('on'); $('#modal').innerHTML = ''; ui.modalOpen = false; ui.modalLock = false;
    ui.modalLive = null; ui.mnodes = []; ui.pendingImport = null; // cancelar uma importação descarta o estado validado
    $('#app').removeAttribute('inert');
    profileDraft = null;
    if (reset) { ui.queue = []; profileQueued = false; }
    if (ui.queue.length) { ui.returnPending = true; const q = ui.queue.shift(); setTimeout(q, 120); return; }
    const rf = ui.returnFocus; ui.returnFocus = null;
    if (rf) { const t = rf.el && rf.el.isConnected ? rf.el : findKey(document, rf.key); if (t && !t.disabled) t.focus({ preventScroll: true }); }
  };
  const enqueue = (fn) => { if (ui.modalOpen) ui.queue.push(fn); else fn(); };
  UI.queueModal = enqueue;

  // ---------------- IDENTIDADE DO COMANDANTE ----------------
  const profileWritable = () => !H.session || H.session.role === 'writer';
  const avatarArt = (avatar, cls) => A.commanderAvatar(avatar, cls || '');
  function profileHTML(editing) {
    const draft = profileDraft;
    const avatar = D.commanderAvatars[draft.avatar];
    return `<div class="profile-layout">
      <div class="profile-hero" style="--profile-accent:${avatar.color}">
        <div class="profile-brand"><span class="profile-sun" aria-hidden="true"></span> HELIOS <b>IDLE</b></div>
        <div class="profile-hero-copy"><span class="profile-eyebrow">Programa de exploração solar</span><span class="profile-mission">SEU LUGAR ENTRE AS ESTRELAS</span></div>
        <div class="profile-preview-portrait" aria-hidden="true">${avatarArt(draft.avatar)}</div>
        <div class="profile-pass"><span class="profile-eyebrow">Comando Hélios</span><strong class="profile-preview-name">${esc(draft.name || 'Seu comandante')}</strong><span class="profile-preview-role">${esc(avatar.label)}</span><span class="profile-pass-line" aria-hidden="true"></span><span class="profile-pass-bottom">EXPLORAR · AUTOMATIZAR · ATRAVESSAR</span></div>
      </div>
      <form id="profile-form" class="profile-form" novalidate>
        <span class="profile-eyebrow">Identidade da missão</span>
        <h2>${editing ? 'Seu comandante' : 'Crie seu comandante'}</h2>
        <p class="profile-intro">Dê um nome ao seu comandante e escolha como aparecer na missão.</p>
        <div class="profile-field"><label for="commander-name">Nome do comandante</label><input id="commander-name" name="commander-name" type="text" value="${esc(draft.name)}" maxlength="48" autocomplete="nickname" autocapitalize="words" spellcheck="false" enterkeyhint="go" aria-describedby="commander-name-help profile-error" required autofocus><span id="commander-name-help" class="profile-field-help"><span>De 2 a 24 caracteres</span><span id="profile-name-count">${Array.from(draft.name).length}/24</span></span></div>
        <fieldset class="profile-avatar-field"><legend>Escolha seu avatar</legend><div class="profile-avatar-grid">${Object.entries(D.commanderAvatars).map(([id, def]) => `<button type="button" class="profile-avatar${draft.avatar === id ? ' selected' : ''}" data-a="profileavatar|${id}" aria-pressed="${draft.avatar === id}" aria-label="${esc(def.name + ', ' + def.label)}" style="--profile-accent:${def.color}">${avatarArt(id)}<span>${esc(def.name)}</span><i aria-hidden="true">✓</i></button>`).join('')}</div><p class="profile-avatar-label">Avatar selecionado: <b id="profile-avatar-label">${esc(avatar.name)}</b></p></fieldset>
        <p id="profile-error" class="profile-error" role="alert" aria-live="polite"></p>
        <div class="profile-actions">${editing ? '<button type="button" class="btn ghost" data-a="close">Cancelar</button>' : ''}<button type="submit" class="btn gold profile-submit">${editing ? 'Salvar comandante' : 'Iniciar missão'}<span aria-hidden="true">↗</span></button></div>
        <p class="profile-local-note">${A.ic('lock', 14)}<span>Seu progresso fica salvo neste navegador. Em Ajustes, você pode guardar uma cópia na sua pasta de saves.</span></p>
      </form>
    </div>`;
  }
  function openProfile(editing) {
    if (!profileWritable()) { UI.toast('Use a aba ativa da partida para editar seu comandante.', 'err'); return; }
    profileDraft = { name: S.profile ? S.profile.name : '', avatar: S.profile ? S.profile.avatar : 'aurora' };
    UI.modal(profileHTML(editing), 'profile-modal', { lock: !editing });
    $('#profile-form').dataset.editing = editing ? 'true' : 'false';
  }
  UI.ensureProfile = function () {
    if (!S || S.profile || profileQueued || $('#profile-form') || !profileWritable()) return;
    profileQueued = true;
    enqueue(() => { profileQueued = false; if (!S.profile) openProfile(false); });
  };
  UI.editProfile = function () {
    if (!S.profile) { UI.ensureProfile(); return; }
    openProfile(true);
  };
  function selectProfileAvatar(id) {
    if (!profileDraft || !Object.prototype.hasOwnProperty.call(D.commanderAvatars, id)) return;
    profileDraft.avatar = id;
    const def = D.commanderAvatars[id];
    $('#modal .profile-hero').style.setProperty('--profile-accent', def.color);
    $('.profile-preview-portrait').innerHTML = avatarArt(id);
    setT($('.profile-preview-role'), def.label);
    setT($('#profile-avatar-label'), def.name);
    for (const button of document.querySelectorAll('.profile-avatar')) { const selected = button.dataset.a === 'profileavatar|' + id; button.setAttribute('aria-pressed', String(selected)); button.classList.toggle('selected', selected); }
  }
  function submitProfile(e) {
    if (e.target.id !== 'profile-form') return;
    e.preventDefault();
    if (!profileDraft || !profileWritable()) return;
    H.audioUnlock && H.audioUnlock();
    const field = $('#commander-name');
    const r = E.setProfile(S, { name: field.value, avatar: profileDraft.avatar });
    if (!r.ok) { setT($('#profile-error'), r.err); field.setAttribute('aria-invalid', 'true'); field.focus(); sfx('err'); return; }
    const editing = e.target.dataset.editing === 'true';
    const returnKey = ui.returnFocus && ui.returnFocus.key;
    const name = S.profile.name;
    const saved = H.save(true, true);
    UI.closeModal(); renderChrome(); UI.frame(true);
    if (editing && !ui.modalOpen && !ui.returnPending) { const target = findKey(document, returnKey); if (target) target.focus({ preventScroll: true }); }
    if (saved.ok) { UI.toast(editing ? 'Comandante atualizado.' : 'Bem-vindo(a) à missão, ' + esc(name) + '.', 'ok'); sfx('promote'); }
    else UI.toast(H.saveMessage(saved), 'err');
  }
  function profileInput(e) {
    if (e.target.id !== 'commander-name' || !profileDraft) return;
    profileDraft.name = e.target.value;
    const name = e.target.value.trim().replace(/\s+/g, ' ');
    setT($('.profile-preview-name'), name || 'Seu comandante');
    setT($('#profile-name-count'), Array.from(e.target.value).length + '/24');
    e.target.removeAttribute('aria-invalid'); setT($('#profile-error'), '');
  }
  // Tab circula só dentro do diálogo aberto (modal do jogo ou aviso de outra aba)
  function trapTab(e) {
    const lock = document.getElementById('lockov');
    const box = lock && lock.classList.contains('on') ? lock.querySelector('.modal') : ui.modalOpen ? $('#modal .modal') : null;
    if (!box) return;
    const f = focusables(box); if (!f.length) { e.preventDefault(); box.focus(); return; }
    const first = f[0], last = f[f.length - 1]; const ae = document.activeElement;
    if (!box.contains(ae)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && (ae === first || ae === box)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && ae === last) { e.preventDefault(); first.focus(); }
  }
  function floatNum(el, text) {
    if (!el || S.settings.reduceMotion) return;
    const r = el.getBoundingClientRect(); const f = document.createElement('div');
    f.className = 'float-num'; f.textContent = text; f.style.left = (r.left + r.width / 2 - 20) + 'px'; f.style.top = (r.top - 6) + 'px';
    document.body.appendChild(f); setTimeout(() => f.remove(), 950);
  }

  // ---------------- TOPO E NAVEGAÇÃO ----------------
  const SCREENS = [
    ['map', 'Sistema'], ['region', 'Região'], ['crew', 'Tripulação'], ['research', 'Pesquisa'], ['exp', 'Expedições'], ['sing', 'Singularidade'], ['settings', 'Ajustes'],
  ];
  const NAVI = { map: 'map', region: 'region', crew: 'crew', research: 'research', exp: 'exp', sing: 'sing', settings: 'settings' };
  function renderChrome() {
    $('#top').innerHTML = `<div class="logo"><span class="sun"></span><span class="txt">HELIOS <b>IDLE</b></span></div>
      <span class="uni-chip" data-u="uni"></span><span class="top-spacer"></span>
      <span class="cur data" title="Dados de pesquisa (permanentes)">${A.rg('data', 16)}<span data-u="data"></span></span>
      <span class="cur frag" title="Fragmentos de Singularidade">${A.rg('frag', 16)}<span data-u="frags"></span></span>
      <button class="commander-chip" data-a="profile" data-k="commander-profile" aria-label="${S.profile ? 'Editar comandante ' + esc(S.profile.name) : 'Criar comandante'}" title="${S.profile ? esc(S.profile.name) : 'Criar comandante'}">${S.profile ? avatarArt(S.profile.avatar) : A.ic('crew', 22)}<span>${S.profile ? esc(S.profile.name) : 'Comandante'}</span></button>
      <button class="save-warn hidden" data-a="nav|settings" data-u="savest" title="O progresso não está sendo salvo neste navegador">${A.ic('warn', 14)} Não salvo</button>
      <button class="icon-btn chest-btn hidden" data-a="openchest" data-u="chestbtn" title="Abrir Baú de Suprimentos" aria-label="Abrir Baú de Suprimentos">${A.ic('chest')}<span class="badge" data-u="chestn"></span></button>
      <button class="icon-btn" data-a="nav|settings" title="Ajustes" aria-label="Ajustes">${A.ic('settings')}</button>`;
    $('#nav').innerHTML = SCREENS.map(([k, l]) => `<button class="nav-btn ${k === 'settings' ? 'settings' : ''}" data-a="nav|${k}" data-u="nav|${k}" aria-label="${l}">${A.ic(NAVI[k], 22)}<span>${l}</span></button>`).join('');
  }

  // ---------------- ASSINATURA (re-render quando a estrutura muda) ----------------
  function sig() {
    const run = S.run; const p = S.perm;
    const base = [ui.screen, run.universe, p.collapses, RO.map((r) => run.regions[r].unlocked ? run.regions[r].phase : '-').join(''), Object.keys(p.specs).join(','), S.settings.dev, S.settings.sci, S.profile && S.profile.name, S.profile && S.profile.avatar].join('|');
    switch (ui.screen) {
      case 'region': {
        const reg = run.regions[ui.rid];
        return base + '|' + ui.rid + ui.rtab + '|' + E.bList(S, ui.rid).join(',') + '|' + E.activeMissions(S, ui.rid).map((x) => x.id).join(',') + '|' + run.routes.map((r) => r.id + r.res.join('') + r.auto + r.lvl).join(',') + '|' + run.dyson.stage + run.core + run.flags.expeditions + '|' + ui.regFilter + ui.nr.from + ui.nr.to + ui.nr.res + '|' + run.log.length + (run.log[0] && run.log[0].t);
      }
      case 'map': return base + '|' + ui.sel + run.routes.map((r) => r.id).join(',') + run.dyson.stage;
      case 'crew': return base + JSON.stringify(Object.values(p.specs).map((s) => s.lvl));
      case 'research': return base + JSON.stringify(p.research) + ui.resSel;
      case 'exp': return base + run.exps.map((e) => e.uid).join(',') + '|' + p.chests.map((c) => c.id).join(',') + run.flags.expeditions + Object.keys(run.flags).filter((k) => k.startsWith('frag:')).join(',') +JSON.stringify(Object.values(p.specs).map((s) => s.lvl));
      case 'sing': return base + run.dyson.stage + run.core + E.canCollapse(S) + ui.uniSel + JSON.stringify(run.dirs) + (run.offer || []).join() + JSON.stringify(p.research) + Object.keys(p.ach).length;
      default: return base + JSON.stringify(S.settings);
    }
  }

  UI.frame = function (force) {
    if (!S) return;
    const g = sig();
    if (force || g !== ui.sig) { ui.sig = g; renderScreen(); }
    refreshModal();
    runUpdaters();
    processEvents();
  };
  UI.go = function (screen, opts) {
    ui.screen = screen; Object.assign(ui, opts || {}); ui.sig = ''; window.scrollTo({ top: 0 }); UI.frame(true);
  };

  function renderScreen() {
    const el = $('#screen');
    const fn = { map: renderMap, region: renderRegion, crew: renderCrew, research: renderResearch, exp: renderExp, sing: renderSing, settings: renderSettings }[ui.screen];
    // preserva o foco do teclado e campos em edição ao refazer a tela
    const ae = document.activeElement; const key = ae && el.contains(ae) ? focusKey(ae) : null;
    const oldBase = el.querySelector('.base-scroll');
    if (oldBase) baseScroll.set(oldBase.dataset.region, oldBase.scrollLeft);
    const io = $('#io'); const ioVal = io ? io.value : null;
    el.innerHTML = fn();
    mountRegionBase();
    const io2 = $('#io'); if (io2 && ioVal) io2.value = ioVal;
    if (key) { const t = findKey(el, key); if (t) t.focus({ preventScroll: true }); }
    ui.nodes = Array.from(document.querySelectorAll('#top [data-u], #nav [data-u], #screen [data-u]'));
    if (ui.screen === 'map') initMap();
    if (ui.hl) { const b = document.getElementById('b-' + ui.hl); if (b) { b.classList.add('hl'); b.scrollIntoView({ behavior: S.settings.reduceMotion ? 'auto' : 'smooth', block: 'center' }); setTimeout(() => b.classList.remove('hl'), 2200); } ui.hl = null; }
  }
  function mountRegionBase() {
    const host = $('#screen .base-map-host'); if (!host) return;
    if (baseRun !== S.run) { baseNodes.clear(); baseScroll.clear(); baseRun = S.run; }
    const rid = host.dataset.region;
    let node = baseNodes.get(rid);
    if (!node) {
      const box = document.createElement('div');
      box.innerHTML = A.scene(rid, S.run.regions[rid], { available: E.bList(S, rid) });
      node = box.firstElementChild; baseNodes.set(rid, node);
    }
    host.appendChild(node);
    node.scrollLeft = baseScroll.get(rid) || 0;
  }
  function runUpdaters() {
    const m = E.mods(S);
    for (const list of [ui.nodes, ui.mnodes || []]) for (const el of list) {
      const a = el.dataset.u.split('|'); const f = U[a[0]];
      if (f) f(el, a, m);
    }
    if (ui.screen === 'map') animMap();
  }

  // ---------------- ATUALIZADORES ----------------
  const U = {};
  U.uni = (el) => setH(el, `<i></i>${D.universes[S.run.universe].name}${S.perm.collapses ? ' · ' + (S.perm.collapses + 1) + 'º ciclo' : ''}`);
  U.data = (el) => setT(el, F.n(S.perm.data));
  U.frags = (el) => setT(el, F.n(S.perm.frags));
  U.foldersave = (el) => {
    const b = H.folderSave, st = b ? b.status() : { supported: false, phase: 'unsupported' };
    const panel = el.closest('.folder-save-panel');
    let text = 'Nenhuma pasta selecionada. O jogo continua salvo neste navegador.';
    if (!st.supported) text = 'Neste navegador, use Baixar cópia para guardar o arquivo na pasta desejada.';
    else if (st.phase === 'choosing') text = 'Escolha uma pasta na janela do navegador.';
    else if (st.phase === 'review') text = 'Aguardando sua escolha sobre o save encontrado na pasta.';
    else if (st.phase === 'permission') text = 'Pasta ' + st.folder + ': autorize novamente para continuar gravando.';
    else if (st.phase === 'saving') text = 'Gravando cópia em ' + st.folder + '…';
    else if (st.phase === 'error') text = st.error || 'Não foi possível gravar na pasta. O salvamento do navegador continua ativo.';
    else if (st.folder) text = 'Pasta: ' + st.folder + (st.lastSaved ? ' · Cópia gravada às ' + new Date(st.lastSaved).toLocaleTimeString('pt-BR') : ' · Conectada');
    if (st.error && st.phase !== 'error') text += ' ' + st.error;
    setT(el, text); setC(el, 'warn', st.phase === 'permission' || st.phase === 'error' || !!st.error);
    const busy = st.phase === 'choosing' || st.phase === 'saving' || st.phase === 'review';
    setD(panel.querySelector('[data-a="folder|choose"]'), !st.supported || busy || !profileWritable());
    setD(panel.querySelector('[data-a="folder|save"]'), !st.folder || busy || !profileWritable());
    setD(panel.querySelector('[data-a="folder|disconnect"]'), !st.folder || busy || !profileWritable());
    setT(panel.querySelector('[data-a="folder|save"]'), st.phase === 'permission' ? 'Autorizar e salvar cópia' : 'Salvar cópia agora');
  };
  U.chestbtn = (el) => setC(el, 'hidden', !S.perm.chests.length);
  U.chestn = (el) => setT(el, String(S.perm.chests.length));
  U.savest = (el) => setC(el, 'hidden', !(H.saveState && H.saveState.failing));
  U.mdata = (el) => setT(el, F.n(S.perm.data));
  U.nav = function (el, a, m) {
    const k = a[1]; setC(el, 'on', ui.screen === k);
    let dot = false;
    if (k === 'region') dot = RO.some((r) => S.run.regions[r].unlocked && E.activeMissions(S, r).some((x) => E.mProg(S, r, x.md, x.id, m).done));
    if (k === 'crew') dot = Object.keys(S.perm.specs).some((s) => E.canPromote(S, s));
    if (k === 'exp') dot = S.perm.chests.length > 0 || S.run.exps.some((e) => S.run.time >= e.end);
    if (k === 'sing') dot = E.canCollapse(S) || E.dirs(S).some((d) => !d.claimed && d.p.done);
    if (k === 'research') dot = Object.keys(D.research).some((id) => { const st = E.resState(S, id); return st.can && st.cur === 'data' && st.cost <= S.perm.data * 0.6; });
    let d = el.querySelector('.dot');
    if (dot && !d) { d = document.createElement('i'); d.className = 'dot'; el.appendChild(d); } else if (!dot && d) d.remove();
  };
  // recursos
  U.resv = (el, a, m) => {
    const reg = S.run.regions[a[1]]; const inb = E.inbound(S, a[1], a[2]);
    setH(el, F.n(reg.st[a[2]] || 0) + ' <small>/ ' + F.n(E.cap(S, a[1], a[2], m)) + '</small>' + (inb >= 1 ? `<span class="inb" title="Espaço reservado para cargas a caminho">+${F.n(inb)} a caminho</span>` : ''));
  };
  U.resr = (el, a) => { const v = S.run.regions[a[1]].rate[a[2]] || 0; setT(el, (v >= 0 ? '+' : '') + F.n(v, Math.abs(v) < 10 && v !== 0 ? 1 : undefined) + '/s'); setC(el, 'ok', v > 0.01); setC(el, 'bad', v < -0.01); setC(el, 'dim', Math.abs(v) <= 0.01); };
  U.resb = (el, a, m) => { const reg = S.run.regions[a[1]]; const cap = E.cap(S, a[1], a[2], m); setW(el, (reg.st[a[2]] || 0) / cap); const box = el.closest('.res'); if (box) setC(box, 'full', (reg.st[a[2]] || 0) >= cap - 0.5); };
  U.rese = (el, a) => { const on = !!S.run.regions[a[1]].exp[a[2]]; setC(el, 'on', on); setT(el, on ? 'EXP ✓' : 'EXP'); };
  U.energy = (el, a) => {
    const en = S.run.regions[a[1]].en; const ok = en.ratio >= 0.999;
    setH(el, `<span class="row">${A.rg('energy', 18)}<b class="num">${F.n(en.gen)} MW</b><span class="muted small">gerados</span></span>
      <div class="bar ${ok ? 'ok' : 'gold'}"><i style="width:${Math.min(100, en.gen > 0 ? en.use / en.gen * 100 : 100).toFixed(1)}%"></i></div>
      <span class="row small"><span class="num">${F.n(en.use)} MW em uso</span>${ok ? '<span class="ok">✓ suficiente</span>' : `<span class="bad">${A.ic('warn', 14)} déficit — velocidade ${F.pct(en.ratio)}</span>`}</span>`);
  };
  U.bneck = (el, a) => {
    const b = E.bottleneck(S, a[1]);
    setC(el, 'energy', b.kind === 'energy'); setC(el, 'input', b.kind === 'input'); setC(el, 'full', b.kind === 'full'); setC(el, 'ok', b.kind === 'ok');
    const ic = b.kind === 'ok' ? `<span class="ok">${A.ic('check')}</span>` : b.kind === 'manual' ? `<span class="cyan">${A.ic('play')}</span>` : `<span class="warn">${A.ic('warn')}</span>`;
    const btn = b.src ? `<button class="btn sm" data-a="planroute|${b.src}|${a[1]}|${b.res}">${b.route !== null ? 'Ver rotas' : 'Planejar rota'}</button>` : '';
    setH(el, `${ic}<div><span class="muted tiny">GARGALO ATUAL</span><b>${esc(b.text)}</b><span class="small muted">${esc(b.hint)}</span>${btn}</div>`);
  };
  // instalações
  U.basecount = (el, a) => {
    const reg = S.run.regions[a[1]]; const slots = A.baseLayout(a[1]);
    setT(el, slots.filter(({ bid }) => reg.b[bid] && reg.b[bid].n > 0).length + ' / ' + slots.length + ' tipos construídos');
  };
  U.baseslot = (el, a, m) => {
    const rid = a[1], bid = a[2]; const reg = S.run.regions[rid]; const def = D.buildings[bid]; const bs = reg.b[bid] || { n: 0, lvl: 1 };
    const built = bs.n > 0, available = built || E.bAvail(S, rid, bid), auto = built && !def.passive && E.isAuto(m, def) && !bs.pause;
    let mode = !built ? 'PLANEJADA' : def.passive ? 'ATIVA' : bs.pause ? 'PAUSADA' : auto ? 'AUTO' : bs.on ? 'OPERANDO' : 'MANUAL';
    let issue = '';
    if (built && !def.passive && bs.why && !['manual', 'paused'].includes(bs.why)) {
      issue = E.whyText(S, rid, bs.why);
      mode = bs.why.startsWith('full') ? 'CHEIO' : bs.why.startsWith('energy') ? 'ENERGIA' : 'SEM INSUMO';
    }
    const state = [bs.n, bs.lvl, available, auto, mode, issue, !!F.sci].join('|');
    if (el._baseState === state) return; el._baseState = state;
    setC(el, 'is-built', built); setC(el, 'is-empty', !built); setC(el, 'is-locked', !available);
    setC(el, 'is-auto', auto); setC(el, 'is-warning', !!issue); setC(el, 'is-paused', !!bs.pause); setD(el, !available);
    const sprite = el.querySelector('.base-sprite'); const wanted = built ? bid : '';
    if (sprite.dataset.sprite !== wanted) { setH(sprite, built ? A.bIcon(bid) : ''); sprite.dataset.sprite = wanted; }
    setT(el.querySelector('.base-badge'), built ? 'Nv. ' + bs.lvl + ' · ×' + F.n(bs.n) : '+ Construir');
    setT(el.querySelector('.base-mode'), built ? mode : '');
    const label = def.name + (built ? ', nível ' + bs.lvl + ', quantidade ' + F.n(bs.n) + ', ' + (issue || mode.toLowerCase()) : ', local disponível para construir') + '. Abrir controles de produção.';
    el.setAttribute('aria-label', label); el.title = label;
  };
  function bInfo(rid, bid, m) {
    const reg = S.run.regions[rid]; const def = D.buildings[bid]; const bs = reg.b[bid] || { n: 0, lvl: 1 };
    const auto = E.isAuto(m, def) && !bs.pause; const ratio = reg.en.ratio;
    const sp = E.speedOf(def, m); const T = def.t ? def.t / Math.max(1e-9, sp * (bs.on || auto ? ratio : 1)) : 0;
    return { reg, def, bs, auto, T, sp };
  }
  U.bcount = (el, a) => { const bs = S.run.regions[a[1]].b[a[2]] || { n: 0, lvl: 1 }; setT(el, bs.n ? '×' + bs.n + ' · Nível ' + bs.lvl : 'Não construída'); };
  U.btag = (el, a, m) => {
    const def = D.buildings[a[2]]; const bs = S.run.regions[a[1]].b[a[2]] || {};
    let h;
    if (def.passive) h = '<span class="tag passive">Passiva</span>';
    else if (E.isAuto(m, def)) { const sid = D.cats[def.cat].spec; h = `<span class="tag auto">${bs.pause ? 'Pausada' : 'Auto'} · ${D.specs[sid].name} ${F.x(D.specSpeed[S.perm.specs[sid].lvl])}</span>`; }
    else h = '<span class="tag manual">Manual</span>';
    setH(el, h);
  };
  U.brecipe = (el, a, m) => {
    const { def, bs } = bInfo(a[1], a[2], m); const n = Math.max(1, bs.n);
    if (def.gen) { setH(el, `${A.rg('energy')} +${F.n(E.genOf(S, a[1], a[2], m, n, bs.lvl))} MW ${def.solar ? `<span class="dim">(luz solar ${F.pct(E.solarFactor(S, a[1], m) / m.genSolar * 1)})</span>` : ''}`); return; }
    if (def.storage) { setH(el, `+${F.pct(def.storage * n * D.levelYield(bs.lvl))} de armazenamento na região`); return; }
    const ins = def.in ? Object.keys(def.in).map((r) => `${A.rg(r)} ${F.n(def.in[r] * n)}`).join(' + ') + ' → ' : '';
    const outs = Object.keys(def.out).map((r) => `${A.rg(r)} ${F.n(def.out[r] * n * E.yieldOf(def, bs, r, m) * (r === 'data' ? m.dataGain : 1), 1)} ${r === 'data' ? 'dados' : D.res[r].name.toLowerCase().replace('dyson', 'Dyson')}`).join(' + ');
    setH(el, `<span class="dim">Por ciclo:</span> ${ins}${outs}`);
  };
  U.bstat = (el, a, m) => {
    const { def, bs, auto, T } = bInfo(a[1], a[2], m);
    if (def.passive) { setT(el, def.gen ? 'Funciona continuamente' : 'Efeito permanente'); return; }
    const r = Object.keys(def.out)[0]; const eff = auto ? (bs.eff !== undefined ? bs.eff : 1) : 1;
    const rate = bs.n ? def.out[r] * bs.n * E.yieldOf(def, bs, r, m) * (r === 'data' ? m.dataGain : 1) / T * eff : 0;
    setH(el, `Ciclo <b class="num">${F.dur(T)}</b> · ${auto ? '' : '<span class="dim">se operada: </span>'}<b class="num ${auto ? 'ok' : ''}">+${F.n(rate, rate < 10 ? 2 : undefined)}/s</b> ${r === 'data' ? 'dados' : D.res[r].name.toLowerCase().replace('dyson', 'Dyson')}`);
  };
  U.bprog = (el, a, m) => { const { bs, auto, T } = bInfo(a[1], a[2], m); const fast = auto && T < 0.3 && !bs.blk; setW(el, fast ? 1 : (bs.on || auto ? bs.p || 0 : 0)); setC(el.parentNode, 'ok', fast); };
  U.bwhy = (el, a, m) => {
    const { def, bs, auto } = bInfo(a[1], a[2], m); let cls = 'idle', t = '';
    if (def.passive) { t = ''; }
    else if (!bs.n) { t = 'Construa para começar a operar.'; }
    else if (bs.pause) { t = 'Pausada'; }
    else if (E.manualWaiting(bs)) { cls = 'warn'; t = E.whyText(S, a[1], bs.why) + ' — o produto do ciclo aguarda espaço para descarregar'; }
    else if (!auto) { if (bs.on) { cls = 'ok'; t = 'Ciclo manual em andamento…'; } else if (bs.why && bs.why !== 'manual') { cls = 'bad'; t = E.whyText(S, a[1], bs.why); } else { t = 'Aguardando comando — toque em Operar'; } }
    else if (bs.why === 'energylow') { cls = 'warn'; t = 'Limitada por energia (' + F.pct(S.run.regions[a[1]].en.ratio) + ')'; }
    else if (bs.why === 'energy') { cls = 'bad'; t = 'Energia insuficiente'; }
    else if (bs.why) { cls = bs.why.startsWith('full') ? 'warn' : 'bad'; t = E.whyText(S, a[1], bs.why) + (bs.eff > 0.02 ? ' — ' + F.pct(bs.eff) + ' da capacidade' : ''); }
    else { cls = 'ok'; t = '✓ Operando'; }
    el.className = 'status ' + cls; setT(el, t);
  };
  U.bop = (el, a, m) => {
    const { def, bs, auto } = bInfo(a[1], a[2], m);
    setC(el, 'hidden', def.passive || auto || !bs.n);
    if (def.passive || auto || !bs.n) return;
    const reg = S.run.regions[a[1]]; let can = !bs.on;
    if (can && def.in) for (const r in def.in) if ((reg.st[r] || 0) < def.in[r] * bs.n) can = false;
    setD(el, !can); setH(el, bs.on ? 'Operando…' : `${A.ic('play', 16)} Operar`); setC(el, 'pulse', can && S.run.regions.lua.phase === 0);
  };
  U.bbuild = (el, a, m) => {
    const rid = a[1], bid = a[2]; const reg = S.run.regions[rid]; const def = D.buildings[bid]; const bs = reg.b[bid] || { n: 0, lvl: 1 };
    const cost = E.bCost(S, rid, bid, m); let ben = '';
    if (def.gen) ben = '+' + F.n(E.genOf(S, rid, bid, m, 1, bs.lvl)) + ' MW';
    else if (def.storage) ben = '+' + F.pct(def.storage * D.levelYield(bs.lvl)) + ' armazenamento';
    else { const r = Object.keys(def.out)[0]; const d = E.bRate(S, rid, bid, m, 1) - E.bRate(S, rid, bid, m); ben = '+' + F.n(d, d < 10 ? 2 : undefined) + '/s ' + (r === 'data' ? 'dados' : D.res[r].name.toLowerCase().replace('dyson', 'Dyson')); }
    const over = Object.keys(cost).find((r) => cost[r] > E.cap(S, rid, r, m));
    setD(el, !E.afford(reg, cost));
    setH(el, `<span>Construir +1</span>${costHTML(cost, reg)}<span class="benefit">${ben}</span>${over ? `<span class="tiny warn">Excede o armazenamento de ${D.res[over].name.toLowerCase().replace('dyson', 'Dyson')}</span>` : ''}`);
  };
  U.bup = (el, a, m) => {
    const rid = a[1], bid = a[2]; const reg = S.run.regions[rid]; const def = D.buildings[bid]; const bs = reg.b[bid] || { n: 0, lvl: 1 };
    if (!bs.n) { setD(el, true); setH(el, '<span>Melhorar</span><span class="tiny dim">Construa primeiro</span>'); return; }
    if (bs.lvl >= D.maxBuildingLevel) { setD(el, true); setH(el, '<span>Nível máximo</span>'); return; }
    const cost = E.uCost(S, rid, bid, m); const y0 = D.levelYield(bs.lvl), y1 = D.levelYield(bs.lvl + 1);
    let ben = 'Rendimento ' + F.x(y0) + ' → ' + F.x(y1);
    if (def.gen) ben = '+' + F.n(E.genOf(S, rid, bid, m, bs.n, bs.lvl + 1) - E.genOf(S, rid, bid, m, bs.n, bs.lvl)) + ' MW';
    else if (!def.passive) { const d = E.bRate(S, rid, bid, m, 0, 1) - E.bRate(S, rid, bid, m); ben += ' (+' + F.n(d, d < 10 ? 2 : undefined) + '/s)'; }
    setD(el, !E.afford(reg, cost));
    setH(el, `<span>Melhorar → Nv ${bs.lvl + 1}</span>${costHTML(cost, reg)}<span class="benefit">${ben}</span>`);
  };
  U.bpause = (el, a, m) => { const { def, bs } = bInfo(a[1], a[2], m); setC(el, 'hidden', def.passive || !E.isAuto(m, def) || !bs.n); setH(el, A.ic(bs.pause ? 'play' : 'pause', 16)); el.title = bs.pause ? 'Retomar' : 'Pausar'; };
  // missões
  U.phase = (el, a) => {
    const rid = a[1]; const reg = S.run.regions[rid]; const ph = D.regions[rid].phases[reg.phase];
    if (!ph) { setH(el, `<div class="lbl"><b>Região consolidada</b><span class="gold">✓ ${D.regions[rid].phases.length}/${D.regions[rid].phases.length} fases</span></div><div class="bar gold"><i style="width:100%"></i></div>`); return; }
    const ms = E.phaseMissions(S, rid); const done = ms.filter((x) => x.claimed).length;
    setH(el, `<div class="lbl"><b>${ph.name} — ${done}/${ms.length} missões concluídas</b><span class="muted">Fase ${reg.phase + 1}/${D.regions[rid].phases.length}</span></div><div class="bar gold"><i style="width:${done / ms.length * 100}%"></i></div>`);
  };
  U.mis = (el, a, m) => {
    const rid = a[1], id = a[2]; const x = E.activeMissions(S, rid).find((q) => q.id === id); if (!x) return;
    const p = E.mProg(S, rid, x.md, id, m);
    setC(el, 'done', p.done);
    const bar = el.querySelector('.bar > i'); if (bar) setW(bar, p.cur / p.max);
    const num = el.querySelector('.pn');
    if (num) setT(num, x.md.t === 'pay' ? F.pct(Math.min(1, p.cur)) : F.n(Math.min(p.cur, p.max)) + ' / ' + F.n(p.max));
    const cl = el.querySelector('[data-a^="claim"]'); if (cl) { setD(cl, !p.done); setC(cl, 'pulse', p.done); }
    if (x.md.t === 'pay') {
      const pr = E.projectProgress(S, 'm:' + id, x.md.cost); const reg = S.run.regions[rid];
      const pl = el.querySelector('.paylist'); if (pl) setH(pl, Object.keys(x.md.cost).map((r) => `<span class="chip ${(pr.st[r] || 0) >= x.md.cost[r] ? 'ok' : (reg.st[r] || 0) < 1 ? 'lack' : ''}">${A.rg(r)} ${F.n(Math.min(pr.st[r] || 0, x.md.cost[r]))}/${F.n(x.md.cost[r])}</span>`).join(''));
      const pb = el.querySelector('[data-a^="contrib"]'); if (pb) setD(pb, p.done);
    }
  };
  // projetos (Dyson, núcleo, lançamento)
  U.proj = (el, a) => {
    const key = a[1]; const info = E.projectInfo(S, key);
    if (!info.cost) { setH(el, ''); return; }
    const pr = E.projectProgress(S, key, info.cost); const reg = S.run.regions[info.rid];
    setH(el, Object.keys(info.cost).map((r) => { const have = Math.min(pr.st[r] || 0, info.cost[r]); return `<span>${A.rg(r)} ${D.res[r].name}</span><div class="bar ${have >= info.cost[r] ? 'ok' : 'gold'}"><i style="width:${have / info.cost[r] * 100}%"></i></div><span class="num small">${F.n(have)}/${F.n(info.cost[r])} <span class="dim">(estoque ${F.n(reg.st[r] || 0)})</span></span>`; }).join(''));
  };
  U.projbtn = (el, a) => { const info = E.projectInfo(S, a[1]); if (!info.cost) { setD(el, true); return; } const reg = S.run.regions[info.rid]; const pr = E.projectProgress(S, a[1], info.cost); setD(el, !info.avail || !Object.keys(info.cost).some((r) => (pr.st[r] || 0) < info.cost[r] && (reg.st[r] || 0) >= 0.5)); };
  // rotas
  U.rstat = (el, a, m) => {
    const rt = S.run.routes.find((r) => r.id === +a[1]); if (!rt) return;
    let t;
    const cargo = () => Object.keys(rt.cargo).map((r) => A.rg(r) + ' ' + F.n(rt.cargo[r])).join(' ');
    if (rt.st === 'out') t = `<span class="cyan">${A.ic('ship', 14)} Indo para ${regName(rt.to)} — ${F.t(rt.T - rt.t)}</span> <span class="dim">${cargo()}</span>${rt.win ? ' <span class="win">janela</span>' : ''}`;
    else if (rt.st === 'wait') t = `<span class="warn">${A.ic('warn', 14)} Aguardando espaço no destino (${regName(rt.to)})</span> <span class="dim">a bordo: ${cargo()}</span> <span class="tiny muted">descarrega sozinho quando houver espaço</span>`;
    else if (rt.st === 'back') t = `<span class="muted">Retornando a ${regName(rt.from)} — ${F.t(rt.T - rt.t)}</span>`;
    else if (rt.why) t = `<span class="warn">${A.ic('warn', 14)} ${E.routeWhyText(rt.why)}</span>`;
    else t = `<span class="muted">No porto de ${regName(rt.from)}</span>`;
    setH(el, t + ` <span class="dim small">· ${rt.trips || 0} viagens${rt.exported >= 1 ? ' · ' + F.n(rt.exported) + ' exportados no destino' : ''}</span>`);
  };
  U.rprog = (el, a) => { const rt = S.run.routes.find((r) => r.id === +a[1]); if (!rt) return; setW(el, rt.st === 'idle' ? 0 : rt.st === 'wait' ? 0.5 : rt.st === 'out' ? rt.t / rt.T * 0.5 : 0.5 + rt.t / rt.T * 0.5); };
  U.rinfo = (el, a, m) => {
    const rt = S.run.routes.find((r) => r.id === +a[1]); if (!rt) return;
    const i = E.routeInfo(S, rt, m);
    setH(el, `<span>${F.n(i.d, 2)} UA</span> · <span>viagem ${F.t(i.T)}</span> · <span>${A.rg('fuel')} ${F.n(i.fuel)}/viagem</span> · <span>carga ${F.n(i.cap)}</span> · ${i.win ? `<span class="win">✓ Janela favorável (−${F.pct(i.wb)} tempo e combustível)</span>` : `<span class="muted">proximidade ${F.pct(i.q)}</span>`}`);
  };
  U.rsend = (el, a, m) => { const rt = S.run.routes.find((r) => r.id === +a[1]); if (!rt) return; setC(el, 'hidden', m.routeAuto && rt.auto); setD(el, rt.st !== 'idle'); };
  U.rupb = (el, a, m) => {
    const rt = S.run.routes.find((r) => r.id === +a[1]); if (!rt) return; const reg = S.run.regions[rt.from];
    if (rt.lvl >= D.route.maxLvl) { setD(el, true); setH(el, 'Nível máximo'); return; }
    const c = E.routeUpCost(S, rt, m); setD(el, !E.afford(reg, c));
    setH(el, `<span>Ampliar cargueiro → Nv ${rt.lvl + 1}</span>${costHTML(c, reg)}<span class="benefit">Carga ${F.n(E.routeInfo(S, rt, m).cap)} → ${F.n(Math.floor(D.route.baseCap * Math.pow(D.route.capPerLvl, rt.lvl) * m.cargo))}</span>`);
  };
  U.rnew = (el, a, m) => {
    const nr = ui.nr; if (!nr.to || nr.from === nr.to) { setH(el, '<span class="muted">Escolha origem e destino diferentes.</span>'); return; }
    const fake = { from: nr.from, to: nr.to, lvl: 1 }; const i = E.routeInfo(S, fake, m); const c = E.routeCost(S, m, nr.from); const reg = S.run.regions[nr.from];
    setH(el, `<div class="small">${F.n(i.d, 2)} UA · viagem ${F.t(i.T)} · ${A.rg('fuel')} ${F.n(i.fuel)} por viagem · carga ${F.n(i.cap)} ${i.win ? '· <span class="win">janela favorável agora</span>' : ''}</div><div class="row wrap small"><span class="muted">Custo do cargueiro (em ${regName(nr.from)}):</span>${costHTML(c, reg)}</div>`);
    const b = $('#nr-btn'); if (b) setD(b, !E.afford(reg, c));
  };
  // tripulação
  U.spec = (el, a) => {
    const sid = a[1]; const s = S.perm.specs[sid]; if (!s) return;
    const c = s.lvl < D.specMaxLevel ? E.promoteCost(S, sid) : null; const can = E.canPromote(S, sid);
    setC(el, 'can', can);
    if (el.tagName === 'BUTTON') { const lbl = `${D.specs[sid].name}, ${D.specs[sid].role}, nível ${s.lvl}${can ? ', pronto para promover' : ''}. Abrir detalhes`; if (el._lbl !== lbl) { el.setAttribute('aria-label', lbl); el._lbl = lbl; } }
    const cb = el.querySelector('.cards'); if (cb) setH(cb, c ? `<span>Cartas ${s.cards}/${c.cards}</span><span class="${S.perm.data >= c.data ? 'cyan' : 'muted'}">${A.rg('data')} ${F.n(c.data)}</span>` : '<span class="gold">Nível máximo</span>');
    const bar = el.querySelector('.bar > i'); if (bar && c) setW(bar, s.cards / c.cards);
    let up = el.querySelector('.up'); if (can && !up) { up = document.createElement('span'); up.className = 'up'; up.textContent = 'PROMOVER'; el.appendChild(up); } else if (!can && up) up.remove();
  };
  // pesquisa
  U.rnode = (el, a) => {
    const st = E.resState(S, a[1]); setC(el, 'can', !st.max && st.can); setC(el, 'locked', !st.max && st.locked); setC(el, 'max', st.max);
    const n = D.research[a[1]]; const lbl = `${n.name}, nível ${st.lvl} de ${n.max}${st.max ? ', completo' : st.locked ? ', bloqueado' : st.can ? ', disponível' : ''}`;
    if (el._lbl !== lbl) { el.setAttribute('aria-label', lbl); el._lbl = lbl; }
  };
  U.rbuy = (el, a) => { const st = E.resState(S, a[1]); setD(el, st.max || !st.can); };
  // expedições
  U.exprog = (el, a) => { const e = S.run.exps.find((x) => x.uid === +a[1]); if (!e) return; setW(el, 1 - Math.max(0, e.end - S.run.time) / e.dur); };
  U.extime = (el, a) => { const e = S.run.exps.find((x) => x.uid === +a[1]); if (!e) return; const left = e.end - S.run.time; setH(el, left > 0 ? 'Retorna em ' + F.t(left) : '<span class="gold">Concluída! Recompensas prontas.</span>'); const c = el.closest('.exp'); if (c) setC(c, 'done', left <= 0); };
  U.excol = (el, a) => { const e = S.run.exps.find((x) => x.uid === +a[1]); if (!e) return; setD(el, S.run.time < e.end); setC(el, 'pulse', S.run.time >= e.end); };
  U.exbtn = (el, a, m) => {
    const id = a[1]; const def = D.expeditions[id]; const av = E.expAvail(S, id); const reg = S.run.regions[def.region];
    const full = S.run.exps.length >= E.expSlots(S, m); const aff = E.afford(reg, def.cost);
    setD(el, !av.ok || full || !aff);
    setH(el, !av.ok ? av.why : full ? 'Todas as sondas em campo' : !aff ? 'Faltam recursos em ' + regName(def.region) : 'Lançar sonda (' + F.t(E.expDur(S, id, m)) + ')');
  };
  U.excost = (el, a) => { const def = D.expeditions[a[1]]; setH(el, costHTML(def.cost, S.run.regions[def.region])); };
  U.slots = (el, a, m) => setT(el, S.run.exps.length + '/' + E.expSlots(S, m) + ' sondas em campo');
  // singularidade
  U.creq = (el) => setH(el, E.collapseReqs(S).map((r) => `<div class="req ${r.ok ? 'ok' : ''}">${A.ic(r.ok ? 'check' : 'lock', 18)}<span class="grow">${r.label}</span><span class="num small">${r.cur}/${r.max}</span></div>`).join(''));
  U.frag = (el) => {
    const f = E.fragCalc(S); const C = D.collapse;
    const rate = E.valueRate(S); const f2 = E.fragCalc(S, rate * 3600);
    setH(el, `<div class="kv"><span class="k">Produção acumulada (valor ponderado)</span><span class="v">${F.n(f.value)}</span>
      <span class="k">Por produção: ⌊${C.prodK} × (valor ÷ ${F.n(C.prodRef)})<sup>${String(C.prodExp).replace('.', ',')}</sup>⌋</span><span class="v">${f.prod}</span>
      <span class="k">Regiões consolidadas (×${C.perRegion})</span><span class="v">${f.regions}</span>
      <span class="k">Etapas do enxame de Dyson</span><span class="v">${f.stages}</span>
      <span class="k">Núcleo da Singularidade</span><span class="v">${f.core}</span>
      <span class="k">Multiplicador de pesquisa</span><span class="v">${F.x(f.mult)}</span>
      <span class="k tot gold">Fragmentos ao colapsar</span><span class="v tot gold">${f.total}</span></div>
      <p class="small muted">Benefício de continuar: produzindo no ritmo atual por mais 1 hora, o Colapso renderia <b class="purple">${f2.total}</b> fragmentos (+${f2.total - f.total}). Gastar materiais não reduz a produção já contabilizada.</p>`);
  };
  U.dysonvis = (el) => setH(el, dysonSVG(S.run.dyson.stage));
  U.dir = (el, a) => { const d = E.dirs(S)[+a[1]]; if (!d) return; const bar = el.querySelector('.bar > i'); if (bar) setW(bar, d.p.cur / d.p.max); const n = el.querySelector('.pn'); if (n) setT(n, F.n(Math.min(d.p.cur, d.p.max)) + '/' + F.n(d.p.max)); const b = el.querySelector('.btn'); if (b) setD(b, d.claimed || !d.p.done); };
  U.mapinfo = (el, a, m) => setH(el, mapInfoHTML(m));

  // ---------------- EVENTOS DO MOTOR ----------------
  function processEvents() {
    const ev = S.events; if (!ev || !ev.length || ui.holdEvents) return;
    S.events = [];
    for (const e of ev) {
      if (e.kind === 'recruit') { sfx('promote'); enqueue(() => recruitModal(e.sid)); }
      else if (e.kind === 'phase') { sfx('chest'); }
      else if (e.kind === 'region') { sfx('promote'); UI.toast(`<b class="gold">Nova região:</b> ${esc(e.text)}`, 'gold'); }
      else if (e.kind === 'ach') { sfx('claim'); UI.toast(`<b class="gold">Conquista:</b> ${esc(e.text)}`, 'ach'); }
      else if (!ui.silent) UI.toast(esc(e.text), e.kind === 'story' ? '' : e.kind);
    }
  }

  // ================= TELA: REGIÃO =================
  function relevantRes(rid) {
    const reg = S.run.regions[rid]; const set = new Set();
    for (const b of E.bList(S, rid)) { const d = D.buildings[b]; for (const r in (d.in || {})) set.add(r); for (const r in (d.out || {})) set.add(r); for (const r in d.cost) set.add(r); }
    for (const r in reg.st) if (reg.st[r] >= 0.5) set.add(r);
    for (const k of ['dyson', 'core', 'launch:' + E.nextRegion(rid)]) { const i = E.projectInfo(S, k); if (i.avail && i.rid === rid) for (const r in i.cost) set.add(r); }
    set.delete('data');
    return D.resOrder.filter((r) => set.has(r));
  }
  function regionSwitch() {
    return `<div class="region-switch">${RO.filter((r) => S.run.regions[r].unlocked).map((r) => `<button class="rs-btn ${r === ui.rid ? 'on' : ''}" data-a="reg|${r}"><span class="pl" style="background:radial-gradient(circle at 35% 35%,#fff8,${D.regions[r].color} 40%,${D.regions[r].color2})"></span>${D.regions[r].name}</button>`).join('')}</div>`;
  }
  function renderRegion() {
    if (!S.run.regions[ui.rid] || !S.run.regions[ui.rid].unlocked) ui.rid = 'lua';
    const rid = ui.rid; const R = D.regions[rid]; const reg = S.run.regions[rid]; const m = E.mods(S);
    const nRoutes = S.run.routes.filter((r) => r.from === rid || r.to === rid).length;
    let h = `<div class="region-head"><div class="region-backdrop" aria-hidden="true">${A.img(A.paths.region(rid), A.terrain(rid), 'region-panorama')}</div><div class="over">
        <div><span class="muted small">${esc(R.sub)}</span><h2>${R.name}</h2><span class="small muted">${esc(R.role)}</span></div>
        <div class="phase phase-bar" data-u="phase|${rid}"></div></div></div>
      ${regionSwitch()}
      <div class="tabs"><button class="tab ${ui.rtab === 'prod' ? 'on' : ''}" data-a="rtab|prod">Produção</button><button class="tab ${ui.rtab === 'routes' ? 'on' : ''}" data-a="rtab|routes">Rotas e transporte (${nRoutes})</button></div>`;
    if (ui.rtab === 'routes') return h + renderRoutes(rid, m);
    const res = relevantRes(rid);
    if (SHOW_BASE_PANEL) h += `<section class="base-panel" aria-labelledby="base-title"><div class="base-toolbar"><div><span class="base-eyebrow">Área de construção</span><h3 id="base-title">Base de ${R.name}</h3></div><span class="base-count" data-u="basecount|${rid}"></span></div><div class="base-map-host" data-region="${rid}"></div><div class="base-help"><span>Selecione uma instalação para ver produção e melhorias.</span><span class="base-pan-hint">↔ Deslize para explorar a base</span></div></section>`;
    h += `<div class="region-grid"><div class="main col" style="gap:14px">
      <div class="panel"><h3>Estoque da região <span class="r small muted">EXP = exportar excedente à Terra quando cheio</span></h3><div class="res-strip">${res.map((r) => `<div class="res"><div class="top">${A.rg(r)} ${D.res[r].name}</div><div class="val" data-u="resv|${rid}|${r}"></div><div class="rate" data-u="resr|${rid}|${r}"></div><div class="bar"><i data-u="resb|${rid}|${r}"></i></div><button class="exp" data-a="exp|${rid}|${r}" data-u="rese|${rid}|${r}" aria-label="Exportar excedente de ${D.res[r].name}" title="Exportar excedente: quando o estoque enche, a produção continua, os cargueiros descarregam e o excesso vai para a Terra"></button></div>`).join('')}</div></div>
      <div class="panel"><div class="energy" data-u="energy|${rid}"></div></div>
      <div class="bneck" data-u="bneck|${rid}"></div>
      ${projectsHTML(rid)}
      <div class="bgrid">${E.bList(S, rid).map((b) => buildingCard(rid, b)).join('')}</div>
    </div><div class="side col" style="gap:14px">${missionsHTML(rid)}${specsHTML(rid, m)}
      <div class="panel"><h3>Diário de bordo</h3><div class="log">${S.run.log.slice(0, 10).map((l) => `<div class="${l.kind}">${esc(l.text)}</div>`).join('') || '<span class="muted small">Sem registros.</span>'}</div></div>
    </div></div>`;
    return h;
  }
  function buildingCard(rid, bid) {
    const def = D.buildings[bid];
    return `<div class="bcard" id="b-${bid}" tabindex="-1" aria-label="Controles de ${esc(def.name)}">
      <button class="pause-btn hidden" data-a="pause|${rid}|${bid}" data-u="bpause|${rid}|${bid}"></button>
      <div class="hd">${A.bIcon(bid)}<div class="grow"><div class="nm">${def.name}</div><div class="cnt" data-u="bcount|${rid}|${bid}"></div></div></div>
      <div class="row wrap"><span data-u="btag|${rid}|${bid}"></span><span class="tiny dim">${D.cats[def.cat].name}</span></div>
      <div class="recipe" data-u="brecipe|${rid}|${bid}"></div>
      <div class="small muted" data-u="bstat|${rid}|${bid}"></div>
      ${def.passive ? '' : `<div class="bar"><i data-u="bprog|${rid}|${bid}"></i></div>`}
      <div class="status" data-u="bwhy|${rid}|${bid}"></div>
      <div class="acts">
        <button class="btn gold full-w hidden" data-a="op|${rid}|${bid}" data-u="bop|${rid}|${bid}"></button>
        <button class="btn" data-a="build|${rid}|${bid}" data-u="bbuild|${rid}|${bid}"></button>
        <button class="btn" data-a="up|${rid}|${bid}" data-u="bup|${rid}|${bid}"></button>
      </div></div>`;
  }
  function projectsHTML(rid) {
    let h = '';
    const nr = E.nextRegion(rid);
    if (nr && E.regionDone(S, rid) && !S.run.regions[nr].unlocked) {
      h += projCard('launch:' + nr, `Preparar expedição planetária: ${D.regions[nr].name}`, `${D.regions[nr].role} Carregue a nave com os recursos de ${D.regions[rid].name}. Você pode entregar aos poucos.`, 'gold');
    }
    if (rid === D.dysonRegion && E.projectInfo(S, 'dyson').avail) h += projCard('dyson', `Enxame de Dyson — etapa ${S.run.dyson.stage + 1}/${D.dyson.length}`, `Cada etapa adiciona satélites ao redor do Sol e +${Math.round(D.dysonEnergyPerStage * 100)}% de energia em todas as regiões. O Colapso exige ${D.dysonRequired} etapas.`, 'gold');
    if (rid === D.core.region && E.projectInfo(S, 'core').avail) h += projCard('core', 'Núcleo da Singularidade', 'O projeto revelado pela anomalia. Concluí-lo torna o Colapso possível.', 'purple');
    return h;
  }
  function projCard(key, title, desc, cls) {
    const auto = key === 'dyson' && S.perm.specs.lumen ? `<label class="switch small"><input type="checkbox" data-ch="dysonauto" ${S.run.dyson.auto ? 'checked' : ''}> Contribuição automática (Lúmen)</label>` : '';
    return `<div class="proj ${cls}"><div class="row sb wrap"><b>${title}</b>${auto}</div><div class="small muted">${desc}</div><div class="preq" data-u="proj|${key}"></div><button class="btn ${cls} block" data-a="contrib|${key}" data-u="projbtn|${key}">Entregar recursos disponíveis</button></div>`;
  }
  function missionsHTML(rid) {
    const R = D.regions[rid]; const reg = S.run.regions[rid];
    let h = `<div class="panel"><h3>Missões</h3><div class="phase-bar" data-u="phase|${rid}"></div><div class="sep"></div>`;
    if (reg.phase >= R.phases.length) {
      const nr = E.nextRegion(rid);
      h += `<div class="empty">Todas as fases de ${R.name} foram concluídas.<br>${nr ? (S.run.regions[nr].unlocked ? `<button class="btn" data-a="reg|${nr}">Ir para ${D.regions[nr].name}</button>` : 'Prepare a expedição planetária ao lado.') : 'Siga para a Singularidade.'}</div></div>`;
      return h;
    }
    const act = E.activeMissions(S, rid); const all = E.phaseMissions(S, rid); const left = all.filter((x) => !x.claimed).length - act.length;
    h += '<div class="mis-list">' + act.map((x) => {
      const md = x.md; const pay = md.t === 'pay';
      return `<div class="mis" data-u="mis|${rid}|${x.id}"><div class="t">${esc(E.mTitle(md))}</div>${md.desc ? `<div class="d">${esc(md.desc)}</div>` : ''}
        ${pay ? `<div class="costs paylist"></div>` : ''}
        <div class="row"><div class="bar grow"><i></i></div><span class="pn small num"></span></div>
        <div class="rw">${rewardHTML(md.rw)}</div>
        <div class="ma">${pay ? `<button class="btn sm" data-a="contrib|m:${x.id}">Entregar</button>` : `<button class="btn ghost sm" data-a="goto|${rid}|${x.id}">Ir</button>`}<button class="btn gold sm" data-a="claim|${rid}|${x.id}">Resgatar</button></div></div>`;
    }).join('') + '</div>';
    if (left > 0) h += `<div class="small dim" style="margin-top:8px">+${left} missão(ões) nesta fase. Recompensa da fase: Baú de Suprimentos.</div>`;
    return h + '</div>';
  }
  function specHow(sid) {
    for (const rid of RO) D.regions[rid].phases.forEach((ph, p) => ph.missions.forEach((md) => { if (md.rw && md.rw.spec === sid) sid = { rid, ph: ph.name, t: md.title }; }));
    return sid;
  }
  function howToGet(sid) {
    const r = specHow(sid);
    if (typeof r === 'object') return `Missão garantida: ${D.regions[r.rid].name} — ${r.ph}`;
    if (sid === 'lumen') return 'Conclua o enxame de Dyson (' + D.dysonRequired + ' etapas).';
    if (sid === 'eco') return 'Realize o primeiro Colapso.';
    if (sid === 'reliquia') return 'Expedição “Ruínas Precursoras” no Universo Ancestral.';
    return '';
  }
  function specsHTML(rid, m) {
    const cats = new Set(E.bList(S, rid).map((b) => D.buildings[b].cat));
    const list = D.specOrder.filter((s) => (D.cats[D.specs[s].cat] && cats.has(D.specs[s].cat)) || D.regions[rid].specs.includes(s));
    return `<div class="panel"><h3>Especialistas da região</h3><div class="spec-mini">${list.map((sid) => {
      const s = S.perm.specs[sid];
      return `<button type="button" class="sm" data-a="spec|${sid}" style="border-color:${s ? rarColor(sid) : 'var(--line)'}" aria-label="${s ? esc(D.specs[sid].name + ', nível ' + s.lvl + '. Abrir detalhes') : 'Especialista desconhecido. Como obter'}">${A.portraitBox(sid, !s)}<span class="blk"><b>${s ? D.specs[sid].name : '???'}</b><span class="tiny muted blk">${s ? 'Nv ' + s.lvl + ' · ' + E.specLabel(sid, s.lvl) : esc(howToGet(sid))}</span></span></button>`;
    }).join('')}</div></div>`;
  }

  // ---------------- ROTAS ----------------
  function renderRoutes(rid, m) {
    const unl = RO.filter((r) => S.run.regions[r].unlocked);
    if (unl.length < 2) return `<div class="panel empty">As rotas de transporte ficam disponíveis quando houver uma segunda região. Conclua as fases da Lua e prepare a expedição a Marte.</div>`;
    if (!unl.includes(ui.nr.from)) ui.nr.from = rid;
    if (!ui.nr.to || !unl.includes(ui.nr.to) || ui.nr.to === ui.nr.from) ui.nr.to = unl.find((r) => r !== ui.nr.from);
    const opt = (sel, v) => unl.map((r) => `<option value="${r}" ${r === v ? 'selected' : ''}>${D.regions[r].name}</option>`).join('');
    const ropt = (v, none) => (none ? '<option value="">—</option>' : '') + D.resOrder.map((r) => `<option value="${r}" ${r === v ? 'selected' : ''}>${D.res[r].name}</option>`).join('');
    const routes = S.run.routes.filter((r) => !ui.regFilter || r.from === rid || r.to === rid);
    let h = `<div class="panel"><h3>Nova rota</h3><div class="newroute">
      <label>Origem<select data-ch="nr|from">${opt(0, ui.nr.from)}</select></label>
      <label>Destino<select data-ch="nr|to">${opt(0, ui.nr.to)}</select></label>
      <label>Recurso transportado<select data-ch="nr|res">${ropt(ui.nr.res)}</select></label>
      <button class="btn" id="nr-btn" data-a="rcreate">Construir cargueiro</button></div>
      <div style="margin-top:8px" data-u="rnew"></div>
      <p class="tiny muted">Os planetas se movem: quando dois estão próximos, abre-se uma <b class="ok">janela de transporte</b> com viagens mais curtas e mais baratas. As viagens continuam disponíveis o tempo todo. O combustível é pago na origem.${m.routeAuto ? '' : ' Recrute <b>Vega</b> para automatizar as rotas.'}</p></div>
      <div class="row sb" style="margin:12px 0"><b>Rotas ${ui.regFilter ? 'de ' + D.regions[rid].name : 'de todo o sistema'} (${routes.length})</b><label class="switch small"><input type="checkbox" data-ch="regfilter" ${ui.regFilter ? 'checked' : ''}> Só desta região</label></div>
      <div class="col">`;
    h += routes.map((rt) => `<div class="route">
        <div class="path">${regName(rt.from)} ${A.ic('ship', 16)} ${regName(rt.to)} <span class="chip">Cargueiro Nv ${rt.lvl}</span></div>
        <div class="small" data-u="rstat|${rt.id}"></div><div class="bar"><i data-u="rprog|${rt.id}"></i></div>
        <div class="small muted" data-u="rinfo|${rt.id}"></div>
        <div class="cfg"><span class="muted">Prioridade:</span>${[0, 1, 2].map((i) => `<select data-ch="rres|${rt.id}|${i}" aria-label="Recurso ${i + 1}">${ropt(rt.res[i] || '', i > 0)}</select>`).join('')}
          <span class="muted">Reserva mínima na origem</span><input type="number" min="0" step="10" value="${rt.reserve || 0}" data-ch="rreserve|${rt.id}">
          <label class="switch"><input type="checkbox" data-ch="rauto|${rt.id}" ${rt.auto ? 'checked' : ''} ${m.routeAuto ? '' : 'disabled'}> Automática${m.routeAuto ? '' : ' (requer Vega)'}</label></div>
        <div class="row wrap"><button class="btn gold sm" data-a="rsend|${rt.id}" data-u="rsend|${rt.id}">Enviar carga</button><button class="btn sm" data-a="rup|${rt.id}" data-u="rupb|${rt.id}"></button><button class="btn ghost sm" data-a="rdel|${rt.id}">Desmontar</button></div>
      </div>`).join('') || '<div class="panel empty">Nenhuma rota ainda.</div>';
    return h + '</div>';
  }

  // ================= TELA: MAPA =================
  const VIS = (rid) => rid === 'terra' ? D.earth.vis : D.regions[rid].vis;
  function visPos(rid, t) { const p = E.pos(rid === 'lua' ? 'terra' : rid, t); const v = VIS(rid === 'lua' ? 'terra' : rid); let x = Math.cos(p.a) * v, y = Math.sin(p.a) * v; if (rid === 'lua') { const ma = t / 40; x += Math.cos(ma) * 16; y += Math.sin(ma) * 16; } return { x, y }; }
  function renderMap() {
    let belt = ''; let seed = 7; const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let i = 0; i < 160; i++) { const a = rnd() * 6.283, r = 192 + rnd() * 20; belt += `<circle cx="${(Math.cos(a) * r).toFixed(1)}" cy="${(Math.sin(a) * r).toFixed(1)}" r="${(rnd() * 1.3 + 0.4).toFixed(1)}" fill="#a08f7a" opacity=".55"/>`; }
    const orbits = ['mercurio', 'venus', 'terra', 'marte', 'jupiter', 'saturno', 'urano', 'netuno'].map((r) => `<circle class="orbit ${r !== 'terra' && S.run.regions[r].unlocked ? 'on' : ''}" r="${VIS(r)}"/>`).join('');
    const pls = RO.map((rid) => {
      const reg = S.run.regions[rid]; const prev = RO[RO.indexOf(rid) - 1];
      const next = !reg.unlocked && prev && E.regionDone(S, prev);
      const sz = { lua: 6, mercurio: 7, venus: 9, marte: 8, cinturao: 7, jupiter: 16, saturno: 13, urano: 11, netuno: 11 }[rid];
      const body = rid === 'cinturao' ? `<path d="M-6 -3l5-4 6 2 1 6-6 4-6-3z" fill="url(#pl-g-cinturao)"/>` : A.planetBody(rid, sz);
      return `<g class="pl ${reg.unlocked ? 'on' : 'locked'} ${next ? 'next' : ''} ${ui.sel === rid ? 'sel' : ''}" id="mp-${rid}" data-a="mapsel|${rid}" role="button" tabindex="0" aria-pressed="${ui.sel === rid}" aria-label="${D.regions[rid].name}${reg.unlocked ? '' : ' (bloqueado)'}">
        <circle class="hit" r="${sz + 14}"/>${next ? `<circle class="ring" r="${sz + 7}"/>` : ''}${ui.sel === rid ? `<circle class="selr" r="${sz + 5}"/>` : ''}${body}
        <text class="lbl" y="${sz + 16}" text-anchor="middle">${D.regions[rid].name.split(' ')[0]}${reg.unlocked ? '' : ' 🔒'}</text></g>`;
    }).join('');
    const earth = `<g class="pl on ${ui.sel === 'terra' ? 'sel' : ''}" id="mp-terra" data-a="mapsel|terra" role="button" tabindex="0" aria-pressed="${ui.sel === 'terra'}" aria-label="Terra"><circle class="hit" r="16"/>${ui.sel === 'terra' ? '<circle class="selr" r="13"/>' : ''}<circle r="9" fill="url(#pl-g-terra)"/><text class="lbl" y="-14" text-anchor="middle">Terra</text></g>`;
    return `<div class="screen-title"><h2>Sistema Solar</h2><span class="muted small">Órbitas em tempo comprimido · toque em um planeta</span></div>
      <div class="map-wrap"><div class="map"><svg viewBox="-370 -370 740 740" id="mapsvg">${A.planetDefs()}
        <circle r="70" fill="url(#sun-g)" opacity=".7"/><circle r="26" fill="url(#sun-core)"/>
        <g id="dyson"></g>${orbits}<g>${belt}</g><g id="routes"></g>${earth}${pls}</svg>
        <div class="map-legend"><span><i style="background:var(--cyan)"></i>rota</span><span><i style="background:var(--ok)"></i>janela favorável</span><span><i style="background:var(--gold)"></i>próxima expedição</span></div></div>
      <div class="side col"><div class="panel"><div data-u="mapinfo"></div><div style="margin-top:10px">${mapBtnHTML()}</div></div></div></div>`;
  }
  let mapEls = null;
  function initMap() {
    mapEls = { pl: {}, routes: $('#routes'), dyson: $('#dyson') };
    for (const rid of RO.concat('terra')) mapEls.pl[rid] = document.getElementById('mp-' + rid);
    let r = ''; for (const rt of S.run.routes) r += `<line class="route-line" id="rl-${rt.id}"/><circle class="shipdot" r="3" id="rs-${rt.id}"/>`;
    mapEls.routes.innerHTML = r;
    const n = S.run.dyson.stage * 8; let d = '';
    for (let i = 0; i < n; i++) { const ring = 34 + (i % 3) * 7; const a = i / n * 6.283; d += `<rect class="sat" x="${(Math.cos(a) * ring).toFixed(1)}" y="${(Math.sin(a) * ring).toFixed(1)}" width="3" height="3"/>`; }
    mapEls.dyson.innerHTML = d;
  }
  function animMap() {
    if (!mapEls) return; const t = S.run.time; const m = E.mods(S); const P = {};
    for (const rid of RO.concat('terra')) { const p = visPos(rid, t); P[rid] = p; const el = mapEls.pl[rid]; if (el) el.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`); }
    for (const rt of S.run.routes) {
      const l = document.getElementById('rl-' + rt.id), s = document.getElementById('rs-' + rt.id); if (!l) continue;
      const a = P[rt.from], b = P[rt.to]; l.setAttribute('x1', a.x); l.setAttribute('y1', a.y); l.setAttribute('x2', b.x); l.setAttribute('y2', b.y);
      l.classList.toggle('win', E.routeInfo(S, rt, m).win);
      let k = rt.st === 'out' ? rt.t / rt.T : rt.st === 'wait' ? 1 : rt.st === 'back' ? 1 - rt.t / rt.T : 0;
      s.setAttribute('cx', a.x + (b.x - a.x) * k); s.setAttribute('cy', a.y + (b.y - a.y) * k); s.style.opacity = rt.st === 'idle' ? 0.3 : 1;
    }
    if (mapEls.dyson && !S.settings.reduceMotion) mapEls.dyson.setAttribute('transform', `rotate(${(t * 6) % 360})`);
  }
  function mapInfoHTML(m) {
    const rid = ui.sel;
    if (rid === 'terra') return `<h3>Terra</h3><p class="small">Origem da missão Hélios. A Terra acompanha a operação e recebe o excedente exportado pelas regiões.</p><p class="small muted">Sua posição define as janelas de transporte da Lua.</p>`;
    const R = D.regions[rid]; const reg = S.run.regions[rid];
    let h = `<h3>${R.name} <span class="r small">${esc(R.sub)}</span></h3><p class="small">${esc(R.role)}</p>`;
    if (!reg.unlocked) {
      const prev = RO[RO.indexOf(rid) - 1];
      h += E.regionDone(S, prev) ? `<p class="gold small">Pronta para a expedição planetária. Prepare-a em ${D.regions[prev].name}.</p>`
        : `<p class="muted small">${A.ic('lock', 14)} Conclua todas as fases de ${D.regions[prev].name} para preparar a expedição.</p>`;
      return h;
    }
    const ph = R.phases[reg.phase];
    h += `<div class="kv small"><span class="k">Fase</span><span class="v">${ph ? ph.name : 'Consolidada'}</span><span class="k">Instalações</span><span class="v">${Object.values(reg.b).reduce((a, b) => a + b.n, 0)}</span><span class="k">Energia</span><span class="v">${F.n(reg.en.gen)} / ${F.n(reg.en.use)} MW</span></div><div class="sep"></div>`;
    const top = Object.entries(reg.rate).filter(([, v]) => v > 0.01).sort((a, b) => b[1] * D.res[b[0]].v - a[1] * D.res[a[0]].v).slice(0, 5);
    h += top.length ? '<div class="col small">' + top.map(([r, v]) => `<span>${A.rg(r)} ${D.res[r].name}: <b class="ok">+${F.n(v, v < 10 ? 1 : undefined)}/s</b></span>`).join('') + '</div>' : '<span class="small muted">Sem produção automatizada.</span>';
    const rts = S.run.routes.filter((r) => r.from === rid || r.to === rid);
    if (rts.length) h += '<div class="sep"></div><b class="small">Janelas de transporte</b><div class="col small">' + rts.map((rt) => { const i = E.routeInfo(S, rt, m); return `<span>${regName(rt.from)} → ${regName(rt.to)}: ${i.win ? '<span class="win">favorável</span>' : 'proximidade ' + F.pct(i.q)} · ${F.t(i.T)}</span>`; }).join('') + '</div>';
    return h;
  }
  function mapBtnHTML() {
    const rid = ui.sel; if (rid === 'terra') return '';
    if (S.run.regions[rid].unlocked) return `<button class="btn block" data-a="openreg|${rid}">Abrir ${D.regions[rid].name}</button>`;
    const prev = RO[RO.indexOf(rid) - 1];
    return E.regionDone(S, prev) ? `<button class="btn gold block" data-a="openreg|${prev}">Preparar em ${D.regions[prev].name}</button>` : '';
  }

  // ================= TELA: TRIPULAÇÃO =================
  function renderCrew() {
    const owned = D.specOrder.filter((s) => S.perm.specs[s]); const lock = D.specOrder.filter((s) => !S.perm.specs[s]);
    const card = (sid) => {
      const sp = D.specs[sid]; const s = S.perm.specs[sid];
      if (!s) return `<div class="card locked" style="--rar:var(--line2)">${A.portraitBox(sid, true, 'por')}<div class="nm">???</div><div class="role">${sp.role}</div><div class="tiny muted">${esc(howToGet(sid))}</div></div>`;
      return `<button type="button" class="card" style="--rar:${rarColor(sid)}" data-a="spec|${sid}" data-u="spec|${sid}"><span class="por-wrap blk">${A.portraitBox(sid, false, 'por')}<span class="lvl">Nv ${s.lvl}</span><span class="rar">${D.rarities[sp.rarity].name}</span></span>
        <span class="blk"><span class="nm blk">${sp.name}</span><span class="role blk">${sp.role} · ${sp.kind}</span></span>
        <span class="mult"><b>${E.specLabel(sid, s.lvl)}</b>${s.lvl < D.specMaxLevel ? `<span class="small muted">→ ${E.specLabel(sid, s.lvl + 1).split(' ').pop()}</span>` : ''}</span>
        <span class="cards"></span><span class="bar gold blk"><i></i></span></button>`;
    };
    return `<div class="screen-title"><h2>Tripulação</h2><span class="muted small">${owned.length}/${D.specOrder.length} especialistas · cartas repetidas e dados de pesquisa promovem</span></div>
      <div class="crew-grid">${owned.map(card).join('')}${lock.map(card).join('')}</div>`;
  }
  function specCatBuildings(sid) { const cat = D.specs[sid].cat; return Object.keys(D.buildings).filter((b) => D.buildings[b].cat === cat); }
  // Painel do especialista: "vivo" — acompanha cartas, dados, nível e disponibilidade enquanto aberto.
  function specActive(sid) { const bl = specCatBuildings(sid); return RO.reduce((a, r) => a + (S.run.regions[r].unlocked ? bl.filter((b) => (S.run.regions[r].b[b] || {}).n).length : 0), 0); }
  function specSig(sid) {
    const s = S.perm.specs[sid]; if (!s) return 'locked';
    const c = s.lvl < D.specMaxLevel ? E.promoteCost(S, sid) : null;
    return [s.lvl, s.cards, E.canPromote(S, sid), c ? S.perm.data + 1e-9 >= c.data : '', specActive(sid)].join('|');
  }
  UI.openSpec = function (sid) {
    UI.modal(specHTML(sid), S.perm.specs[sid] ? 'wide' : '', { live: { sig: () => specSig(sid), render: () => specHTML(sid) } });
  };
  function specHTML(sid) {
    const sp = D.specs[sid]; const s = S.perm.specs[sid];
    if (!s) return `<h2>${sp.role}</h2><p>${esc(sp.desc)}</p><p class="gold">${esc(howToGet(sid))}</p><div class="foot"><button class="btn" data-a="close">Fechar</button></div>`;
    const bl = specCatBuildings(sid); const active = specActive(sid);
    const c = s.lvl < D.specMaxLevel ? E.promoteCost(S, sid) : null; const can = E.canPromote(S, sid);
    const extra = E.specExtra(sid, s.lvl);
    return (`<div class="spec-detail" style="--rar:${rarColor(sid)}">${A.portraitBox(sid, false, 'por')}<div class="col">
      <h2 style="margin:0">${sp.name} <span class="chip" style="color:${rarColor(sid)}">${D.rarities[sp.rarity].name}</span></h2>
      <div class="muted">${sp.role} · ${sp.kind} · Nível ${s.lvl}</div><p class="small" style="margin:4px 0">${esc(sp.desc)}</p><i class="small dim">“${esc(sp.quote)}”</i>
      ${bl.length ? `<div class="small"><b>Instalações afetadas:</b> ${bl.map((b) => D.buildings[b].name).join(', ')}</div><div class="small"><b>Automação:</b> <span class="ok">ativa</span> em ${active} tipo(s) de instalação no universo atual. Novas instalações da categoria são automatizadas ao serem liberadas.</div>` : ''}
      ${extra ? `<div class="small"><b>Efeito adicional:</b> ${extra}</div>` : ''}
      ${c ? `<div class="promo-cmp"><div><span class="small muted">Atual (Nv ${s.lvl})</span><b class="cyan">${E.specLabel(sid, s.lvl)}</b></div><span>→</span><div><span class="small muted">Próximo (Nv ${s.lvl + 1})</span><b class="gold">${E.specLabel(sid, s.lvl + 1)}</b></div></div>
        <div class="row sb small"><span>Cartas: <b class="${s.cards >= c.cards ? 'ok' : ''}">${s.cards}/${c.cards}</b></span><span>Custo: <b class="${S.perm.data + 1e-9 >= c.data ? 'cyan' : 'bad'}">${A.rg('data')} ${F.n(c.data)} dados</b> <span class="muted">(você tem <span data-u="mdata"></span>)</span></span></div><div class="bar gold"><i style="width:${Math.min(100, s.cards / c.cards * 100)}%"></i></div>
        <p class="tiny muted">Velocidade ${F.x(2)} = ciclos duas vezes mais rápidos, respeitando insumos, energia e armazenamento. Não altera o rendimento por ciclo.</p>` : '<p class="gold">Nível máximo alcançado.</p>'}
      </div></div><div class="foot"><button class="btn ghost" data-a="close">Fechar</button>${c ? `<button class="btn gold" data-a="promote|${sid}|${s.lvl}" data-k="promote" ${can ? '' : 'disabled'} ${can ? 'autofocus' : ''}>Promover a Nv ${s.lvl + 1}</button>` : ''}</div>`);
  }
  function recruitModal(sid) {
    const sp = D.specs[sid];
    UI.modal(`<h2 class="gold">★ Novo especialista!</h2><div class="reveal"><div class="rc" style="--rar:${rarColor(sid)};width:180px">${A.portraitBox(sid, false)}<b>${sp.name}</b><span class="tiny muted">${sp.role}</span></div></div><p class="small" style="text-align:center">${esc(sp.desc)}</p><p class="small muted" style="text-align:center">“${esc(sp.quote)}”</p><div class="foot"><button class="btn gold" data-a="close" autofocus>Bem-vindo(a) à tripulação</button></div>`);
  }

  // ================= TELA: PESQUISA =================
  function effText(id, lvl) {
    const e = D.research[id].eff; const v = e.v * lvl;
    switch (e.k) {
      case 'speed': return '+' + F.pct(v) + ' velocidade (' + D.cats[e.cat].name + ')';
      case 'yieldCat': return '+' + F.pct(v) + ' rendimento (' + D.cats[e.cat].name + ')';
      case 'yieldRes': return '+' + F.pct(v) + ' ' + D.res[e.res].name.toLowerCase().replace('dyson', 'Dyson') + ' por ciclo';
      case 'gen': case 'genReactor': return '+' + F.pct(v) + ' energia';
      case 'use': return '−' + F.pct(Math.min(0.8, v)) + ' consumo de energia';
      case 'storage': return '+' + F.pct(v) + ' armazenamento';
      case 'cargo': return '+' + F.pct(v) + ' carga';
      case 'travel': return '−' + F.pct(Math.min(0.7, v)) + ' tempo de viagem';
      case 'fuel': return '−' + F.pct(Math.min(0.7, v)) + ' combustível';
      case 'costRed': return '−' + F.pct(Math.min(0.7, v)) + ' custos';
      case 'expReward': return '+' + F.pct(v) + ' recompensas';
      case 'expTime': return '−' + F.pct(Math.min(0.7, v)) + ' duração';
      case 'expSlots': return '+' + v + ' sonda(s)';
      case 'dataGain': return '+' + F.pct(v) + ' dados';
      case 'offlineH': return '+' + v + 'h offline';
      case 'window': return '+' + F.pct(v) + ' bônus de janela';
      case 'fragGain': return '+' + F.pct(v) + ' fragmentos';
      case 'globalSpeed': return '+' + F.pct(v) + ' velocidade global';
      case 'missionEase': return '−' + F.pct(v) + ' metas (Lua e Marte)';
      case 'startKit': return lvl + '× kit inicial';
      case 'prefab': return lvl + '× pré-fabricados';
      case 'offers': return lvl ? '4 destinos' : '3 destinos';
    }
    return '';
  }
  function renderResearch() {
    const sel = ui.resSel;
    let h = `<div class="screen-title"><h2>Pesquisa</h2><span class="chip cyan">${A.rg('data')} <span data-u="data"></span> dados</span><span class="chip purple">${A.rg('frag')} <span data-u="frags"></span> fragmentos</span><span class="muted small">Projetos permanentes: são preservados no Colapso.</span></div><div class="tree">`;
    for (const br in D.branches) {
      const B = D.branches[br];
      h += `<div class="branch" style="--bc:${B.color}"><h4>${B.name}</h4>` + Object.keys(D.research).filter((id) => D.research[id].br === br).map((id) => {
        const n = D.research[id]; const st = E.resState(S, id); const lvl = st.lvl;
        return `<button type="button" class="node ${sel === id ? 'sel' : ''}" data-a="rsel|${id}" data-u="rnode|${id}" aria-pressed="${sel === id}" aria-controls="res-detail"><span class="nn">${n.name}</span><span class="pips" aria-hidden="true">${Array.from({ length: n.max }, (_, i) => `<i class="${i < lvl ? 'f' : ''}"></i>`).join('')}</span>
          <span class="tiny muted">${st.max ? 'Completo' : st.locked ? 'Requer ' + n.req.map((r) => D.research[r].name).join(', ') : (n.cur === 'frag' ? A.rg('frag') : A.rg('data')) + ' ' + F.n(st.cost)}</span></button>`;
      }).join('') + '</div>';
    }
    h += '</div>';
    if (sel) {
      const n = D.research[sel]; const st = E.resState(S, sel);
      h += `<div class="panel res-detail" id="res-detail" aria-live="polite"><div class="row sb wrap"><div><b>${n.name}</b> <span class="muted small">(${D.branches[n.br].name} · nível ${st.lvl}/${n.max})</span><div class="small">${esc(n.desc)}</div>
        <div class="small">Efeito atual: <b class="cyan">${st.lvl ? effText(sel, st.lvl) : 'nenhum'}</b>${st.max ? '' : ` → próximo: <b class="gold">${effText(sel, st.lvl + 1)}</b>`}</div></div>
        ${st.max ? '<span class="chip ok">Completo</span>' : `<button class="btn ${n.cur === 'frag' ? 'purple' : ''}" data-a="rbuy|${sel}|${st.lvl}" data-k="rbuy" data-u="rbuy|${sel}">Pesquisar · ${n.cur === 'frag' ? A.rg('frag') : A.rg('data')} ${F.n(st.cost)}</button>`}</div></div>`;
    } else h += '<p class="small muted">Toque em um projeto para ver o benefício e o custo antes de confirmar.</p>';
    return h;
  }

  // ================= TELA: EXPEDIÇÕES =================
  function renderExp() {
    const m = E.mods(S); const run = S.run;
    let h = `<div class="screen-title"><h2>Expedições</h2>${run.flags.expeditions ? `<span class="chip cyan" data-u="slots"></span>` : ''}</div>`;
    if (S.perm.chests.length) h += `<div class="panel"><h3>Baús de Suprimentos</h3><div class="chests">${S.perm.chests.map((c) => `<div class="chest-card">${A.img(A.paths.ui('chest'), A.chest(false))}<b class="small">${esc(c.title)}</b><button class="btn gold sm block" data-a="chest|${c.id}">Abrir</button></div>`).join('')}</div></div>`;
    if (!run.flags.expeditions) return h + `<div class="panel empty">${A.ic('lock', 28)}<p>As expedições exigem a <b>Doca Orbital</b>.<br>Ela é montada na missão “Montar a Doca Orbital” da Lua, fase Base Orbital.</p></div>`;
    if (run.exps.length) h += `<div class="panel"><h3>Sondas em campo</h3><div class="exp-grid">${run.exps.map((e) => { const d = D.expeditions[e.id]; return `<div class="exp run"><div class="hd">${d.spec ? A.portraitBox(d.spec, !S.perm.specs[d.spec]) : A.portraitBox(d.recruit, !S.perm.specs[d.recruit])}<div class="grow"><b>${d.name}</b><div class="small muted" data-u="extime|${e.uid}"></div></div></div><div class="bar"><i data-u="exprog|${e.uid}"></i></div><button class="btn gold" data-a="excol|${e.uid}" data-u="excol|${e.uid}">Coletar recompensas</button></div>`; }).join('')}</div></div>`;
    const ids = Object.keys(D.expeditions).filter((id) => !E.expAvail(S, id).hidden);
    h += `<div class="panel"><h3>Destinos <span class="r small muted">recompensa mínima garantida + bônus possíveis</span></h3><div class="exp-grid">` + ids.map((id) => {
      const d = D.expeditions[id]; const who = d.spec || d.recruit;
      const g = []; for (const s in (d.g.cards || {})) g.push(`<span class="chip gold">${Math.max(1, Math.round(d.g.cards[s] * m.expReward))}× ${D.specs[s].name}</span>`);
      if (d.g.data) g.push(`<span class="chip cyan">${A.rg('data')} ${F.n(Math.round(d.g.data * m.expReward))}</span>`);
      const fdone = E.expFragDone(S, id);
      if (d.g.frags) g.push(fdone ? `<span class="chip muted" title="O fragmento desta expedição vem uma vez por universo">${A.rg('frag')} já obtido neste universo</span>` : `<span class="chip purple" title="Uma vez por universo">${A.rg('frag')} ${d.g.frags} (1ª vez no universo)</span>`);
      const b = d.bonus.map(([p, rw]) => { if (rw.frags && fdone && !rw.cards && !rw.data) return ''; return `<span class="chip">${F.pct(p)}: ${rw.cards ? Object.keys(rw.cards).map((s) => rw.cards[s] + '× ' + D.specs[s].name).join(', ') : ''}${rw.data ? rw.data + ' dados' : ''}${rw.frags ? rw.frags + ' fragmento (até 1 por universo)' : ''}</span>`; }).join('') || '<span class="muted">—</span>';
      return `<div class="exp"><div class="hd">${A.portraitBox(who, !S.perm.specs[who])}<div class="grow"><b>${d.name}</b><div class="small muted">Parte de ${D.regions[d.region].name} · ${F.t(E.expDur(S, id, m))}</div></div></div>
        <div class="row wrap small"><span class="muted">Custo:</span><span data-u="excost|${id}"></span></div>
        <div class="row wrap small"><span class="muted">Garantido:</span>${g.join('')}</div><div class="row wrap small"><span class="muted">Possível:</span>${b}</div>
        <button class="btn" data-a="exstart|${id}" data-u="exbtn|${id}"></button></div>`;
    }).join('') + '</div></div>';
    return h;
  }
  function chestModal(res) {
    const ch = res.chest; const cards = Object.keys(ch.cards);
    UI.modal(`<h2 class="gold">${esc(ch.title)}</h2><div class="chest-anim" id="chanim">${A.img(A.paths.ui('chest'), A.chest(false))}</div><div id="chrev" class="hidden"><div class="reveal">${cards.map((s, i) => `<div class="rc" style="--rar:${rarColor(s)};animation-delay:${i * 0.12}s">${A.portraitBox(s, false)}<b>${D.specs[s].name}</b><span class="gold">+${ch.cards[s]} carta${ch.cards[s] > 1 ? 's' : ''}</span></div>`).join('')}</div>
      <p style="text-align:center"><span class="chip cyan">${A.rg('data')} +${F.n(res.data)} dados de pesquisa</span></p></div><div class="foot"><button class="btn gold" data-a="close">Ótimo!</button></div>`);
    const go = () => { const a = $('#chanim'); if (!a) return; a.querySelector('svg').classList.add('open'); a.classList.add('burst'); setTimeout(() => { const r = $('#chrev'); if (r) r.classList.remove('hidden'); if (a) a.classList.add('hidden'); }, S.settings.reduceMotion ? 0 : 650); };
    setTimeout(go, S.settings.reduceMotion ? 0 : 250);
  }

  // ================= TELA: SINGULARIDADE =================
  function dysonSVG(stage) {
    let s = `<svg viewBox="-150 -150 300 300">${A.planetDefs()}<circle r="120" fill="url(#sun-g)" opacity=".5"/><circle r="38" fill="url(#sun-core)"/>`;
    for (let i = 0; i < D.dyson.length; i++) {
      const r = 52 + i * 9; const on = i < stage; const n = 10 + i * 4;
      s += `<circle r="${r}" fill="none" stroke="${on ? 'var(--gold)' : 'rgba(140,180,255,.15)'}" stroke-width="${on ? 1 : 0.6}" stroke-dasharray="${i < D.dysonRequired ? '' : '2 3'}" opacity="${on ? 0.6 : 1}"/>`;
      if (on) for (let k = 0; k < n; k++) { const a = k / n * 6.283 + i; s += `<rect x="${(Math.cos(a) * r - 1.5).toFixed(1)}" y="${(Math.sin(a) * r - 1.5).toFixed(1)}" width="3" height="3" fill="var(--gold)"/>`; }
    }
    return s + '</svg>';
  }
  function renderSing() {
    const run = S.run; const p = S.perm; const can = E.canCollapse(S); const m = E.mods(S);
    const dInfo = E.projectInfo(S, 'dyson');
    let h = `<div class="screen-title"><h2>Singularidade</h2><span class="chip purple">${A.rg('frag')} ${F.n(p.frags)} fragmentos · total ${F.n(p.fragsTotal)} → ${F.x(m.globalYield)} rendimento global</span></div><div class="sing-grid"><div class="col" style="gap:14px">
      <div class="panel"><h3>Enxame de Dyson <span class="r gold">${run.dyson.stage}/${D.dyson.length} etapas</span></h3><div class="dyson-vis" data-u="dysonvis"></div>
        <p class="small muted">Etapas 1–${D.dysonRequired} formam o enxame (requisito do Colapso). Etapas extras rendem mais fragmentos. Bônus atual: +${F.pct(D.dysonEnergyPerStage * run.dyson.stage)} de energia em todas as regiões.</p>
        ${dInfo.avail ? projCard('dyson', `Etapa ${run.dyson.stage + 1} — entregue em Mercúrio`, 'Os recursos saem do estoque de Mercúrio. Use rotas para abastecê-lo.', 'gold') : dInfo.done ? '<p class="gold">Enxame completo!</p>' : '<p class="small muted">' + A.ic('lock', 14) + ' Disponível em Mercúrio, fase “Fundação do Enxame”.</p>'}</div>
      <div class="panel"><h3>Anomalia de Netuno</h3>${run.core ? '<p class="purple">O Núcleo da Singularidade está ativo.</p>' : E.projectInfo(S, 'core').avail ? projCard('core', 'Núcleo da Singularidade', 'Entregue em Netuno.', 'purple') : `<p class="small muted">${A.ic('lock', 14)} ${run.regions.netuno.unlocked ? 'Conclua a fase “Sinal Fantasma” para revelar o projeto.' : 'Um sinal regular vem da borda do sistema. Alcance Netuno para investigá-lo.'}</p>`}</div>
      <div class="panel"><h3>${D.universes[run.universe].name}</h3><p class="small">${esc(D.universes[run.universe].desc)}</p><ul class="small muted">${D.universes[run.universe].traits.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
        <b class="small">Diretrizes deste universo (opcionais)</b><div class="col" style="margin-top:6px">${E.dirs(S).map((d) => `<div class="mis ${d.claimed ? '' : ''}" data-u="dir|${d.i}"><div class="t">${esc(E.mTitle(d.md))}${d.claimed ? ' <span class="ok">✓</span>' : ''}</div><div class="row"><div class="bar grow"><i></i></div><span class="pn small num"></span></div><div class="row sb"><div class="rw">${rewardHTML(d.md.rw)}</div><button class="btn gold sm" data-a="dir|${d.i}">${d.claimed ? 'Resgatada' : 'Resgatar'}</button></div></div>`).join('')}</div></div>
    </div><div class="col" style="gap:14px">
      <div class="panel" style="border-color:rgba(176,124,255,.45)"><h3 class="purple">Colapso</h3><div data-u="creq"></div><div class="sep"></div><div data-u="frag"></div><div class="sep"></div>
        <div class="lists"><div><b class="bad">Será reiniciado</b><ul><li>Instalações e níveis locais</li><li>Estoques de materiais</li><li>Rotas comerciais e cargas a bordo (são materiais locais)</li><li>Regiões liberadas</li><li>Missões locais</li><li>Enxame de Dyson</li></ul></div>
        <div><b class="ok">Será preservado</b><ul><li>Especialistas, cartas e níveis</li><li>Dados de pesquisa</li><li>Projetos permanentes</li><li>Fragmentos de Singularidade</li><li>Baús não abertos</li><li>Conquistas e registros</li></ul></div></div>
        <p class="tiny muted">Pendências: missões concluídas e não resgatadas têm a parte permanente creditada (dados, cartas, especialistas); expedições concluídas são coletadas e as em andamento rendem a recompensa garantida. Nada é perdido em silêncio nem creditado duas vezes.</p>`;
    if (can) {
      const offer = E.collapseOffer(S);
      if (!offer.includes(ui.uniSel)) ui.uniSel = null;
      h += `<b id="uni-lbl">Escolha o destino</b><div class="uni-opts" style="margin-top:8px" role="group" aria-labelledby="uni-lbl">${offer.map((u) => { const U2 = D.universes[u]; return `<button type="button" class="uni-opt ${ui.uniSel === u ? 'sel' : ''}" data-a="uni|${u}" aria-pressed="${ui.uniSel === u}"><span class="sw blk" aria-hidden="true" style="background:radial-gradient(circle at 30% 50%, ${U2.sun}, transparent 45%), linear-gradient(90deg,#0b1630,#160c30)"></span><b>${U2.name}</b>${p.visited[u] ? '<span class="tiny muted">Já visitado</span>' : '<span class="tiny gold">Inédito</span>'}<span class="small">${esc(U2.desc)}</span><span class="ul blk">${U2.traits.map((t) => `<span class="li blk">${esc(t)}</span>`).join('')}</span></button>`; }).join('')}</div>
        <button class="btn purple block" style="margin-top:12px" data-a="collapse" ${ui.uniSel ? '' : 'disabled'}>Iniciar Colapso</button>`;
    } else h += `<p class="small muted">Os destinos possíveis aparecem quando todos os requisitos forem cumpridos.</p>`;
    h += `</div>
      <div class="panel"><h3>Universos visitados</h3>${p.universes.length ? `<table class="t"><tr><th>#</th><th>Universo</th><th>Duração</th><th>Dyson</th><th>Fragmentos</th></tr>${p.universes.map((u, i) => `<tr><td>${i + 1}</td><td>${D.universes[u.u].short}</td><td>${F.t(u.time)}</td><td>${u.dyson}</td><td class="purple">+${u.frags}</td></tr>`).join('')}</table>` : '<p class="small muted">Nenhum Colapso realizado ainda.</p>'}</div>
      <div class="panel"><h3>Conquistas <span class="r small muted">${Object.keys(p.ach).length}/${D.achievements.length}</span></h3><div class="ach-grid">${D.achievements.map((a) => `<div class="ach ${p.ach[a.id] ? 'on' : ''}"><b>${p.ach[a.id] ? '★ ' : ''}${a.name}</b><div class="tiny muted">${a.desc}</div></div>`).join('')}</div></div>
    </div></div>`;
    return h;
  }

  // ================= TELA: AJUSTES =================
  function renderSettings() {
    const st = S.settings;
    const sw = (k, label, desc) => `<label class="switch"><input type="checkbox" data-ch="set|${k}" ${st[k] ? 'checked' : ''}> <span>${label}${desc ? `<br><span class="tiny muted">${desc}</span>` : ''}</span></label>`;
    return `<div class="screen-title"><h2>Ajustes</h2></div><div class="sing-grid"><div class="col" style="gap:14px">
      <div class="panel"><h3>Comandante</h3><div class="commander-settings">${S.profile ? avatarArt(S.profile.avatar) : ''}<div class="grow"><strong>${S.profile ? esc(S.profile.name) : 'Seu perfil de comandante'}</strong><p class="small muted">${S.profile ? esc(D.commanderAvatars[S.profile.avatar].label) : 'Escolha um nome e um avatar para sua missão.'}</p></div><button class="btn sm" data-a="profile" data-k="commander-edit">${S.profile ? 'Editar perfil' : 'Criar perfil'}</button></div></div>
      <div class="panel folder-save-panel"><h3>Pasta de saves</h3><p class="small muted">Escolha uma pasta no seu dispositivo para manter uma cópia automática em <b>helios-idle-save.json</b>. Ela inclui o comandante e todo o progresso.</p><p class="small folder-save-status" data-u="foldersave" role="status" aria-live="polite"></p><div class="row wrap"><button class="btn gold" data-a="folder|choose">Escolher pasta</button><button class="btn" data-a="folder|save">Salvar cópia agora</button><button class="btn ghost" data-a="folder|disconnect">Desconectar pasta</button><button class="btn ghost" data-a="download">Baixar cópia</button></div><p class="tiny muted">Para recuperar, escolha a mesma pasta ou use Abrir arquivo abaixo. O arquivo fica no seu dispositivo. Desconectar mantém a cópia existente.</p></div>
      <div class="panel"><h3>Jogo</h3><div class="col">${sw('sound', 'Som')}${sw('reduceMotion', 'Reduzir movimento', 'Desliga animações e encurta o Colapso.')}${sw('sci', 'Notação científica', 'Mostra 1,23e15 em vez de 1,23Qa.')}${sw('skipAnim', 'Pular animação do Colapso')}</div></div>
      <div class="panel"><h3>Salvamento</h3><p class="small muted">Salvamento automático a cada ${D.AUTOSAVE_SEC}s e após ações importantes. Formato versionado (v${D.SAVE_VERSION}).</p>
        <div class="row wrap"><button class="btn" data-a="save">Salvar agora</button><button class="btn" data-a="export">Exportar</button><button class="btn" data-a="download">Baixar arquivo</button></div>
        <textarea id="io" placeholder="O código exportado aparece aqui. Para importar, cole um código e toque em Importar." style="margin-top:8px"></textarea>
        <div class="row wrap" style="margin-top:8px"><button class="btn" data-a="copy">Copiar</button><button class="btn gold" data-a="import">Importar</button><label class="btn ghost">Abrir arquivo<input type="file" accept=".txt,.json" data-ch="file" hidden></label></div></div>
      <div class="panel"><h3>Reiniciar</h3><p class="small muted">Apaga todo o progresso, inclusive especialistas e fragmentos.</p><button class="btn danger" data-a="reset">Apagar progresso</button></div>
    </div><div class="col" style="gap:14px">
      <div class="panel"><h3>Regras de bônus</h3><ul class="small" style="margin:0;padding-left:18px">
        <li><b>Velocidade</b> (especialistas, pesquisa, universo, Eco): ciclos mais rápidos. Fontes diferentes se multiplicam. ×4 = quatro vezes mais ciclos, sempre respeitando insumos, energia e armazenamento.</li>
        <li><b>Rendimento</b> (nível da instalação, pesquisa, universo, fragmentos): mais produto por ciclo sem gastar mais insumo. Cada nível de instalação soma +50%.</li>
        <li><b>Energia</b>: se o consumo passar da geração, todas as instalações da região desaceleram na mesma proporção.</li>
        <li><b>Transporte</b>: Vega acelera as viagens; pesquisa e melhorias do cargueiro aumentam a carga; janelas reduzem tempo e combustível.</li>
        <li><b>Escopo</b>: especialistas valem para sua categoria em todas as regiões. Níveis de um mesmo projeto de pesquisa somam entre si.</li>
        <li><b>Fragmentos</b>: cada fragmento já recebido dá +${Math.round(D.collapse.fragYield * 100)}% de rendimento global, mesmo depois de gasto.</li>
        <li><b>Profundidade</b>: a cada Colapso, as metas de produção das missões sobem ${Math.round(D.collapse.depthTarget * 100)}% (até ×${D.collapse.depthMax}).</li></ul></div>
      <div class="panel"><h3>Ferramentas de desenvolvimento</h3>${sw('dev', 'Ativar ferramentas', 'Para testar o jogo avançado.')}
        ${st.dev ? `<div class="row wrap" style="margin-top:10px">
          <button class="btn sm" data-a="dev|t60">+1 min</button><button class="btn sm" data-a="dev|t600">+10 min</button><button class="btn sm" data-a="dev|t3600">+1 h</button><button class="btn sm" data-a="dev|t28800">+8 h (relatório)</button>
          <button class="btn sm" data-a="dev|res">Recursos ×1000 na região</button><button class="btn sm" data-a="dev|data">+10 mil dados</button><button class="btn sm" data-a="dev|frag">+10 fragmentos</button>
          <button class="btn sm" data-a="dev|cards">+20 cartas para todos</button><button class="btn sm" data-a="dev|missions">Concluir missões ativas</button><button class="btn sm" data-a="dev|region">Liberar próxima região</button>
          <button class="btn sm" data-a="dev|dyson">+1 etapa Dyson</button><button class="btn sm" data-a="dev|ready">Pronto para Colapso</button></div>` : ''}</div>
      <div class="panel"><h3>Sobre</h3><p class="small muted">HELIOS IDLE — protótipo jogável. Imagens opcionais em <code>assets/</code> substituem automaticamente a arte de reserva.</p></div>
    </div></div>`;
  }

  async function folderAction(action) {
    if (!H.folderSave || !profileWritable()) { UI.toast('Use a aba ativa da partida para salvar na pasta.', 'err'); return; }
    try {
      const b = H.folderSave;
      const result = action === 'choose' ? await b.choose() : action === 'disconnect' ? await b.disconnect() : await b.saveNow();
      if (result.ok && result.existing) {
        const parsed = E.importStr(result.raw);
        UI.queueModal(() => {
          UI.modal(`<h2>Save encontrado na pasta</h2><p class="small">Esta pasta já contém <b>helios-idle-save.json</b>. Escolha qual partida deseja manter.</p>${parsed.ok ? `<p class="small muted">${parsed.S.profile ? esc(parsed.S.profile.name) + ' · ' : ''}${esc(D.universes[parsed.S.run.universe].name)} · ${parsed.S.perm.collapses} Colapso(s).</p><p class="small">Restaurar troca a partida aberta pelo progresso do arquivo.</p>` : `<p class="small warn">O arquivo não pôde ser restaurado: ${esc(parsed.err)}</p>`}<div class="foot"><button class="btn ghost" data-a="foldercancel">Cancelar</button>${parsed.ok ? '<button class="btn gold" data-a="folderrestore">Restaurar save da pasta</button>' : ''}<button class="btn" data-a="foldercurrent">Substituir arquivo pela partida atual</button></div>`);
          ui.folderCandidate = { raw: result.raw };
        });
      } else if (result.ok) {
        UI.toast(action === 'disconnect' ? 'Pasta desconectada. O arquivo foi mantido.' : 'Cópia da partida gravada na pasta.', 'ok');
      } else if (!['cancelled', 'superseded'].includes(result.reason)) UI.toast(result.error || 'Não foi possível usar a pasta. Seu save do navegador foi mantido.', 'err');
    } catch (error) { UI.toast('Não foi possível acessar a pasta. Seu save do navegador foi mantido.', 'err'); }
    UI.frame();
  }
  async function finishFolderChoice(restore) {
    const candidate = ui.folderCandidate;
    if (!candidate || !H.folderSave || !profileWritable()) return;
    const parsed = restore ? E.importStr(candidate.raw) : null;
    if (restore && !parsed.ok) { UI.toast(parsed.err, 'err'); return; }
    ui.folderCandidate = null; UI.closeModal();
    if (restore) {
      const applied = H.replaceState(parsed.S);
      if (applied.status === 'readonly' || applied.status === 'stale') { H.folderSave.cancelChoice(); UI.toast(H.saveMessage(applied), 'err'); return; }
    }
    try {
      const result = await H.folderSave.confirmFolder({ overwrite: true });
      UI.toast(result.ok ? (restore ? 'Progresso restaurado e pasta conectada.' : 'Pasta conectada à partida atual.') : result.error || 'A pasta não pôde ser conectada.', result.ok ? 'ok' : 'err');
    } catch (error) { UI.toast('A partida está no navegador, mas não foi possível gravar na pasta.', 'err'); }
    UI.frame();
  }

  // ================= OFFLINE =================
  UI.offlineReport = function (rep) {
    const prod = Object.entries(rep.prod).filter(([, v]) => v >= 1).sort((a, b) => b[1] * D.res[b[0]].v - a[1] * D.res[a[0]].v);
    const stalls = Object.entries(rep.stall).filter(([, t]) => t > rep.used * 0.2).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, t]) => { const [rid, bid, why] = k.split('|'); return `<li>${D.regions[rid].name}: ${D.buildings[bid].name} — ${E.whyText(S, rid, why)} (${F.t(t)})</li>`; });
    enqueue(() => UI.modal(`<h2>Bem-vindo(a) de volta</h2><p class="small">Ausência: <b>${F.t(rep.away)}</b> · tempo considerado: <b>${F.t(rep.used)}</b>${rep.away > rep.used ? ` <span class="warn">(limite offline de ${F.t(E.offlineCapSec(S))})</span>` : ''}</p>
      <b class="small">Recursos produzidos</b><div class="costs" style="margin:6px 0">${prod.map(([r, v]) => `<span class="chip">${A.rg(r)} +${F.n(v)}</span>`).join('') || '<span class="muted small">Nada — automatize instalações para produzir offline.</span>'}${rep.data >= 1 ? `<span class="chip cyan">${A.rg('data')} +${F.n(rep.data)}</span>` : ''}</div>
      ${rep.exps.length ? `<b class="small">Expedições concluídas</b><ul class="small">${rep.exps.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>` : ''}
      ${rep.missions.length ? `<b class="small">Missões alcançadas</b><ul class="small">${rep.missions.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>` : ''}
      ${stalls.length ? `<b class="small warn">Gargalos encontrados</b><ul class="small">${stalls.join('')}</ul>` : ''}
      <div class="foot"><button class="btn gold" data-a="close" autofocus>Continuar</button></div>`));
  };

  // ================= AÇÕES =================
  const ACT = {
    folder: (action) => { folderAction(action); },
    foldercancel: () => UI.closeModal(),
    foldercurrent: () => finishFolderChoice(false),
    folderrestore: () => finishFolderChoice(true),
    profile: () => UI.editProfile(),
    profileavatar: (id) => selectProfileAvatar(id),
    close: () => UI.closeModal(),
    nav: (k) => { sfx('click'); UI.go(k); },
    reg: (r) => { ui.rid = r; sfx('click'); UI.go('region'); },
    openreg: (r) => { ui.rid = r; ui.rtab = 'prod'; UI.go('region'); },
    mapsel: (r) => { ui.sel = r; sfx('click'); ui.sig = ''; },
    rtab: (t) => { ui.rtab = t; ui.sig = ''; },
    // aviso de gargalo: abre a aba de rotas com origem, destino e recurso já escolhidos
    planroute: (from, to, r) => { if (!D.regions[from] || !D.regions[to] || !D.res[r]) return; ui.rtab = 'routes'; ui.nr.from = from; ui.nr.to = to; ui.nr.res = r; ui.sig = ''; },
    base: (rid, bid) => {
      const card = document.getElementById('b-' + bid); if (!card || rid !== ui.rid || !E.bAvail(S, rid, bid)) return;
      sfx('click'); card.classList.add('hl'); card.focus({ preventScroll: true });
      card.scrollIntoView({ behavior: S.settings.reduceMotion || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) ? 'auto' : 'smooth', block: 'center' });
      setTimeout(() => card.classList.remove('hl'), 2200);
    },
    op: (rid, bid, el) => { const r = E.operate(S, rid, bid); if (r.ok) sfx('click'); else UI.err(r); },
    build: (rid, bid, el) => { const r = E.build(S, rid, bid); if (r.ok) { sfx('buy'); floatNum(el, '+1'); H.save(); } else UI.err(r); },
    up: (rid, bid, el) => { const r = E.upgrade(S, rid, bid); if (r.ok) { sfx('buy'); floatNum(el, 'Nv ' + S.run.regions[rid].b[bid].lvl); H.save(); } else UI.err(r); },
    pause: (rid, bid) => { E.togglePause(S, rid, bid); sfx('click'); },
    exp: (rid, r) => { E.toggleExport(S, rid, r); sfx('click'); },
    claim: (rid, id, el) => {
      const r = E.claim(S, rid, id);
      if (r.ok) { sfx('claim'); if (r.got.data) floatNum(el, '+' + r.got.data + ' dados'); H.save(); if (S.perm.chests.length && E.activeMissions(S, rid).length === 0) {} } else UI.err(r);
    },
    contrib: (key) => { const r = E.contribute(S, key); if (r.ok) { sfx(r.done ? 'promote' : 'buy'); if (r.done) H.save(); } else UI.err(r); },
    goto: (rid, id) => {
      const x = E.activeMissions(S, rid).find((q) => q.id === id); if (!x) return; const md = x.md; sfx('click');
      if (['build', 'level', 'cycles'].includes(md.t)) { ui.hl = md.b; ui.rtab = 'prod'; ui.sig = ''; }
      else if (md.t === 'prod') { ui.hl = E.bList(S, rid).find((b) => D.buildings[b].out && D.buildings[b].out[md.r]); ui.rtab = 'prod'; ui.sig = ''; }
      else if (md.t === 'energy') { ui.hl = E.bList(S, rid).find((b) => D.buildings[b].gen && b !== 'armazem'); ui.rtab = 'prod'; ui.sig = ''; }
      else if (md.t === 'data') { ui.hl = 'obs_profundo'; ui.sig = ''; }
      else if (md.t === 'total') { ui.hl = E.bList(S, rid)[0]; ui.sig = ''; }
      else if (['route', 'deliver', 'ship'].includes(md.t)) { ui.rtab = 'routes'; if (md.t === 'deliver') { ui.nr.to = rid; ui.nr.res = md.r; const src = RO.find((r) => r !== rid && S.run.regions[r].unlocked && E.bList(S, r).some((b) => D.buildings[b].out && D.buildings[b].out[md.r])); if (src) ui.nr.from = src; } ui.sig = ''; }
      else if (md.t === 'exped') UI.go('exp');
      else if (md.t === 'research') UI.go('research');
      else if (md.t === 'promote') UI.go('crew');
      else if (md.t === 'dyson') { if (E.projectInfo(S, 'dyson').avail) { ui.rid = D.dysonRegion; UI.go('region'); } else UI.go('sing'); }
      else if (md.t === 'core') { ui.rid = D.core.region; UI.go('region'); }
    },
    spec: (sid) => { sfx('click'); UI.openSpec(sid); },
    // lvl = nível exibido quando o botão foi desenhado: cliques repetidos ou informação antiga não compram de novo
    promote: (sid, lvl) => {
      const s = S.perm.specs[sid]; if (!s || (lvl !== undefined && s.lvl !== +lvl)) return;
      const r = E.promote(S, sid);
      if (r.ok) { sfx('promote'); H.save(); refreshModal(); const md = $('#modal .modal'); if (md) { md.classList.remove('burst'); void md.offsetWidth; md.classList.add('burst'); } } else UI.err(r);
    },
    rsel: (id) => { ui.resSel = id; sfx('click'); },
    rbuy: (id, lvl) => { if (lvl !== undefined && (S.perm.research[id] || 0) !== +lvl) return; const r = E.buyResearch(S, id); if (r.ok) { sfx('promote'); H.save(); UI.toast('Pesquisa concluída: <b>' + D.research[id].name + '</b> — ' + effText(id, S.perm.research[id]), 'gold'); } else UI.err(r); },
    exstart: (id) => { const r = E.startExp(S, id); if (r.ok) { sfx('buy'); H.save(); } else UI.err(r); },
    excol: (uid) => {
      const r = E.collectExp(S, +uid); if (!r.ok) return UI.err(r);
      sfx('chest'); H.save();
      const t = r.total; const cards = Object.keys(t.cards);
      enqueue(() => UI.modal(`<h2 class="gold">Expedição concluída</h2><p>${esc(r.name)}</p><div class="reveal">${cards.map((s, i) => `<div class="rc" style="--rar:${rarColor(s)};animation-delay:${i * 0.12}s">${A.portraitBox(s, false)}<b>${D.specs[s].name}</b><span class="gold">+${t.cards[s]}</span></div>`).join('')}</div><p style="text-align:center"><span class="chip cyan">${A.rg('data')} +${F.n(t.data)}</span>${t.frags ? ` <span class="chip purple">${A.rg('frag')} +${t.frags}</span>` : ''}</p>${t.fragsDone ? `<p class="small muted" style="text-align:center">O fragmento desta expedição já foi obtido neste universo. Ele volta a ser possível depois do próximo Colapso.</p>` : ''}<div class="foot"><button class="btn gold" data-a="close">Fechar</button></div>`));
    },
    chest: (id) => { const r = E.openChest(S, +id); if (r.ok) { sfx('chest'); H.save(); enqueue(() => chestModal(r)); } },
    openchest: () => { if (S.perm.chests.length) ACT.chest(S.perm.chests[0].id); },
    rsend: (id) => { const r = E.sendRoute(S, +id); if (r.ok) sfx('buy'); else UI.err(r); },
    rup: (id) => { const r = E.upgradeRoute(S, +id); if (r.ok) { sfx('buy'); H.save(); } else UI.err(r); },
    rdel: (id) => { UI.modal(rdelHTML(+id), '', { live: { sig: () => JSON.stringify(E.removePreview(S, +id)), render: () => rdelHTML(+id) } }); },
    rdel2: (id) => {
      const r = E.removeRoute(S, +id); UI.closeModal(); if (!r.ok) return UI.err(r); H.save();
      const lost = Object.keys(r.pv.lost); if (lost.length) UI.toast('Carga sem espaço descartada: ' + lost.map((k) => F.n(r.pv.lost[k]) + ' ' + D.res[k].name.toLowerCase()).join(', '), 'err');
    },
    rcreate: () => { const r = E.createRoute(S, ui.nr.from, ui.nr.to, [ui.nr.res]); if (r.ok) { sfx('promote'); H.save(); UI.toast(`Rota criada: ${regName(ui.nr.from)} → ${regName(ui.nr.to)}`, 'gold'); } else UI.err(r); },
    uni: (u) => { ui.uniSel = u; sfx('click'); },
    collapse: () => {
      const u = ui.uniSel; if (!u || !E.canCollapse(S)) return;
      UI.modal(collapseHTML(u), '', { live: { sig: () => collapseSig(), render: () => collapseHTML(u) } });
    },
    collapse2: (u) => { if (!E.canCollapse(S)) { UI.closeModal(); UI.toast('Os requisitos do Colapso não estão mais cumpridos.', 'err'); return; } UI.closeModal(); H.collapse(u); },
    dir: (i) => { const r = E.claimDir(S, +i); if (r.ok) { sfx('claim'); H.save(); } },
    save: () => { const r = H.save(true, true); UI.toast(H.saveMessage(r), r.ok ? 'ok' : 'err'); if (!r.ok) sfx('err'); },
    export: () => { $('#io').value = E.exportStr(S); $('#io').select(); UI.toast('Código de exportação gerado.'); },
    copy: () => { const t = $('#io'); if (!t.value) t.value = E.exportStr(S); t.select(); (navigator.clipboard ? navigator.clipboard.writeText(t.value) : Promise.reject()).then(() => UI.toast('Copiado.'), () => { document.execCommand('copy'); UI.toast('Copiado.'); }); },
    download: () => { const b = new Blob([E.exportStr(S)], { type: 'text/plain' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'helios-idle-' + new Date().toISOString().slice(0, 10) + '.txt'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); },
    import: () => {
      const r = E.importStr($('#io').value);
      if (!r.ok) { UI.modal(`<h2 class="bad">Não foi possível importar</h2><p>${esc(r.err)}</p><p class="small muted">Seu progresso atual não foi alterado.</p><div class="foot"><button class="btn" data-a="close">Entendi</button></div>`); sfx('err'); return; }
      UI.modal(`<h2>Importar progresso?</h2><p class="small">O progresso atual será substituído pelo do código (${D.universes[r.S.run.universe].name}, ${r.S.perm.collapses} Colapso(s), ${Object.keys(r.S.perm.specs).length} especialistas).</p><div class="foot"><button class="btn ghost" data-a="close">Cancelar</button><button class="btn gold" data-a="import2">Importar</button></div>`);
      ui.pendingImport = r.S; // estado validado e isolado: só substitui a partida na confirmação
    },
    import2: () => {
      const ns = ui.pendingImport; if (!ns) return;
      UI.closeModal(); // também descarta pendingImport
      const r = H.replaceState(ns);
      if (r.ok) UI.toast('Progresso importado e salvo.', 'gold');
      else if (r.status === 'readonly' || r.status === 'stale') UI.toast('Esta aba está em modo de leitura; a importação não foi aplicada.', 'err');
      else UI.toast('Progresso importado nesta aba, mas não foi salvo: ' + (r.msg || '') + '. Use Exportar para guardar uma cópia.', 'err');
    },
    reset: () => UI.modal(`<h2 class="bad">Apagar todo o progresso?</h2><p>Isso não pode ser desfeito. Exporte antes se quiser guardar uma cópia.</p><div class="foot"><button class="btn ghost" data-a="close">Cancelar</button><button class="btn danger" data-a="reset2">Apagar tudo</button></div>`),
    reset2: () => { UI.closeModal(); const r = H.replaceState(E.newState()); UI.go('region', { rid: 'lua' }); if (!r.ok) UI.toast(H.saveMessage(r), 'err'); },
    dev: (cmd) => H.dev(cmd),
  };
  UI.ACT = ACT;
  function onClick(e) {
    if (e.target.id === 'modal' && !ui.modalLock) { UI.closeModal(); return; }
    const t = e.target.closest('[data-a]'); if (!t || t.disabled) return;
    const [a, ...args] = t.dataset.a.split('|'); const f = ACT[a]; if (!f) return;
    H.audioUnlock && H.audioUnlock();
    f(...args, t, e);
    UI.frame();
  }
  function onChange(e) {
    const t = e.target.closest('[data-ch]'); if (!t) return;
    const [k, a1, a2] = t.dataset.ch.split('|');
    if (k === 'nr') { ui.nr[a1] = t.value; ui.sig = ''; }
    else if (k === 'rres') { const rt = S.run.routes.find((r) => r.id === +a1); if (rt) { const arr = rt.res.slice(); arr[+a2] = t.value; rt.res = arr.filter((x, i) => x && arr.indexOf(x) === i); if (!rt.res.length) rt.res = ['metal']; } }
    else if (k === 'rreserve') { const rt = S.run.routes.find((r) => r.id === +a1); if (rt) rt.reserve = Math.max(0, +t.value || 0); }
    else if (k === 'rauto') { const rt = S.run.routes.find((r) => r.id === +a1); if (rt) rt.auto = t.checked; }
    else if (k === 'regfilter') { ui.regFilter = t.checked; }
    else if (k === 'dysonauto') { S.run.dyson.auto = t.checked; }
    else if (k === 'set') { S.settings[a1] = t.checked; H.applySettings(); }
    else if (k === 'file') { const f = t.files[0]; if (f) f.text().then((txt) => { $('#io').value = txt; ACT.import(); }); }
    H.save(); UI.frame();
  }
  // teclado: Escape fecha (quando permitido), Tab fica dentro do diálogo, Enter/Espaço ativam
  // elementos com role="button" que não são botões nativos (planetas do mapa em SVG)
  function onKey(e) {
    if (e.key === 'Escape' && ui.modalOpen && !ui.modalLock && !(H.lockShown && H.lockShown())) { e.preventDefault(); UI.closeModal(); return; }
    if (e.key === 'Tab') { trapTab(e); return; }
    const t = e.target;
    if ((e.key === 'Enter' || e.key === ' ') && t && t.getAttribute && t.getAttribute('role') === 'button' && t.dataset && t.dataset.a && !/^(BUTTON|A|INPUT|SELECT|TEXTAREA)$/.test(t.tagName)) {
      e.preventDefault(); t.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
  }
  function rdelHTML(id) {
    const rt = S.run.routes.find((r) => r.id === id); const pv = E.removePreview(S, id);
    if (!rt || !pv) return '<h2>Rota não encontrada</h2><p class="small">Este cargueiro já foi desmontado.</p><div class="foot"><button class="btn" data-a="close">Fechar</button></div>';
    const list = (o) => Object.keys(o).map((r) => A.rg(r) + ' ' + F.n(o[r])).join(' ');
    const cargo = pv.any ? '<ul class="small">' + (Object.keys(pv.toDest).length ? '<li>Para ' + regName(rt.to) + ': ' + list(pv.toDest) + '</li>' : '') + (Object.keys(pv.toOrigin).length ? '<li>De volta a ' + regName(rt.from) + ': ' + list(pv.toOrigin) + '</li>' : '') + (Object.keys(pv.lost).length ? '<li class="bad">Sem espaço em nenhuma das duas regiões (será descartado): ' + list(pv.lost) + '</li>' : '') + '</ul>' : '<p class="small muted">O cargueiro está sem carga.</p>';
    return '<h2>Desmontar cargueiro?</h2><p class="small">' + regName(rt.from) + ' → ' + regName(rt.to) + '. A carga a bordo vai para o destino até o limite do armazenamento; o restante volta à origem. O custo do cargueiro não é devolvido.</p>' + cargo + '<div class="foot"><button class="btn ghost" data-a="close">Cancelar</button><button class="btn danger" data-a="rdel2|' + id + '">Desmontar</button></div>';
  }
  function collapseSig() { const f = E.fragCalc(S); const p = E.collapsePending(S); return [E.canCollapse(S), f.total, p.missions.length, p.expsDone.length, p.expsRunning.length].join('|'); }
  function collapseHTML(u) {
    if (!E.canCollapse(S)) return '<h2 class="purple">Colapso indisponível</h2><p class="small">Os requisitos não estão mais cumpridos.</p><div class="foot"><button class="btn" data-a="close">Fechar</button></div>';
    const f = E.fragCalc(S); const pend = E.collapsePending(S);
    const cargo = S.run.routes.reduce((a, rt) => a + (rt.st === 'out' || rt.st === 'wait' ? E.cargoTotal(rt) : 0), 0);
    return '<h2 class="purple">Iniciar o Colapso?</h2><p>A singularidade vai engolir este universo. A sonda emergirá no <b>' + D.universes[u].name + '</b>.</p><p>Você receberá <b class="purple">' + f.total + ' Fragmentos de Singularidade</b>.</p>' +
      '<p class="small muted">Pendências: ' + pend.missions.length + ' missão(ões) concluída(s) a creditar, ' + pend.expsDone.length + ' expedição(ões) concluída(s), ' + pend.expsRunning.length + ' em andamento (recompensa garantida).' + (cargo >= 1 ? ' ' + F.n(cargo) + ' unidade(s) de carga a bordo reiniciam junto com os estoques (são materiais locais).' : '') + '</p>' +
      '<div class="foot"><button class="btn ghost" data-a="close">Ainda não</button><button class="btn purple" data-a="collapse2|' + u + '">Atravessar</button></div>';
  }
  UI.chestModal = chestModal;

  UI.init = function (state) {
    S = state; renderChrome();
    document.addEventListener('click', onClick);
    document.addEventListener('change', onChange);
    document.addEventListener('keydown', onKey);
    document.addEventListener('input', profileInput);
    document.addEventListener('submit', submitProfile);
    UI.frame(true);
  };
  UI.setState = function (state) { S = state; ui.sig = ''; renderChrome(); UI.frame(true); };
})(window.H = window.H || {});
