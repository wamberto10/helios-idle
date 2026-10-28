/* HELIOS IDLE — cópia local opcional em uma pasta escolhida pelo jogador.
   Não substitui o salvamento do navegador. Não abre seletores ou permissões no autosave.
   O handle fica no IndexedDB; nenhum caminho ou conteúdo é enviado para um servidor. */
(function (H, root) {
  'use strict';
  const FILE_NAME = 'helios-idle-save.json';
  const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

  function handleStore(indexedDB) {
    let database;
    function open() {
      if (database) return database;
      database = new Promise((resolve, reject) => {
        if (!indexedDB) { reject(new Error('IndexedDB indisponível')); return; }
        let request;
        try { request = indexedDB.open('helios-idle-folder-backups', 1); } catch (error) { reject(error); return; }
        request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('folders')) request.result.createObjectStore('folders'); };
        request.onerror = () => reject(request.error || new Error('Falha ao abrir IndexedDB'));
        request.onblocked = () => reject(new Error('IndexedDB bloqueado por outra aba'));
        request.onsuccess = () => {
          const db = request.result;
          db.onversionchange = () => { db.close(); database = null; };
          resolve(db);
        };
      }).catch(error => { database = null; throw error; });
      return database;
    }
    async function transact(mode, operation) {
      const db = await open();
      return new Promise((resolve, reject) => {
        let transaction, request, value;
        try {
          transaction = db.transaction('folders', mode);
          request = operation(transaction.objectStore('folders'));
        } catch (error) { reject(error); return; }
        request.onsuccess = () => { value = request.result; };
        transaction.oncomplete = () => resolve(value);
        transaction.onerror = () => reject(transaction.error || request.error || new Error('Falha no IndexedDB'));
        transaction.onabort = () => reject(transaction.error || new Error('Operação do IndexedDB cancelada'));
      });
    }
    return {
      get: key => transact('readonly', store => store.get(key)),
      set: (key, handle) => transact('readwrite', store => store.put(handle, key)),
      remove: key => transact('readwrite', store => store.delete(key)),
    };
  }

  H.makeFolderSave = function (options) {
    options = options || {};
    const env = options.env || {};
    const picker = has(env, 'showDirectoryPicker') ? env.showDirectoryPicker : typeof root.showDirectoryPicker === 'function' ? root.showDirectoryPicker.bind(root) : null;
    const storage = env.handleStore || handleStore(has(env, 'indexedDB') ? env.indexedDB : root.indexedDB);
    const now = env.now || Date.now;
    const supported = typeof picker === 'function';
    const key = options.key || 'helios_idle_save';
    let active = null, pending = null, phase = supported ? 'idle' : 'unsupported';
    let lastSaved = 0, error = '', rememberError = '', epoch = 0;
    let writeTail = Promise.resolve(), storeTail = Promise.resolve();
    const B = {};
    const writer = () => { try { return typeof options.isWriter !== 'function' || !!options.isWriter(); } catch (e) { return false; } };
    const notify = () => { if (typeof options.onChange === 'function') { try { options.onChange(B.status()); } catch (e) { /* observador não interrompe o backup */ } } };
    const fail = (reason, message) => ({ ok: false, reason, error: message || '' });
    const usable = (token, handle) => token === epoch && active === handle && !pending && phase !== 'choosing' && writer();
    const restorePhase = () => { phase = active ? 'ready' : supported ? 'idle' : 'unsupported'; };
    function failure(cause, prefix) {
      if (cause && (cause.name === 'NotAllowedError' || cause.name === 'SecurityError')) return prefix + ' A permissão da pasta não está disponível. Autorize a pasta novamente.';
      return prefix + ' Verifique se a pasta está acessível e se há espaço no disco.';
    }
    async function permission(handle, request) {
      try {
        if (typeof handle.queryPermission !== 'function') return false;
        const current = await handle.queryPermission({ mode: 'readwrite' });
        if (current === 'granted') return true;
        return !!request && typeof handle.requestPermission === 'function' && await handle.requestPermission({ mode: 'readwrite' }) === 'granted';
      } catch (e) { return false; }
    }
    function remember(handle) {
      const operation = storeTail.then(async () => {
        try {
          if (handle) await storage.set(key, handle); else await storage.remove(key);
          rememberError = ''; return true;
        } catch (e) {
          rememberError = handle ? 'A pasta foi selecionada, mas o navegador não conseguiu lembrá-la. Escolha-a novamente ao reabrir o jogo.' : 'A pasta foi desconectada nesta sessão, mas o navegador não conseguiu esquecer a seleção anterior.';
          return false;
        } finally { notify(); }
      });
      storeTail = operation.catch(() => false);
      return operation;
    }
    async function discard(stream) {
      if (stream && typeof stream.abort === 'function') { try { await stream.abort(); } catch (e) { /* arquivo original preservado quando possível */ } }
    }
    function enqueue(raw, token, handle) {
      if (typeof raw !== 'string') return Promise.resolve(fail('snapshot', 'Não foi possível preparar a cópia da partida.'));
      const operation = writeTail.then(async () => {
        if (!usable(token, handle)) return fail(writer() ? 'superseded' : 'readonly');
        let stream;
        try {
          // queryPermission não abre diálogo. O autosave nunca chama requestPermission.
          if (!await permission(handle, false)) {
            if (token === epoch && active === handle && !pending) { phase = 'permission'; error = ''; notify(); }
            return fail('permission', 'Autorize a pasta para continuar salvando a cópia local.');
          }
          if (!usable(token, handle)) return fail(writer() ? 'superseded' : 'readonly');
          phase = 'saving'; error = ''; notify();
          const file = await handle.getFileHandle(FILE_NAME, { create: true });
          if (!usable(token, handle)) return fail(writer() ? 'superseded' : 'readonly');
          stream = await file.createWritable();
          if (!usable(token, handle)) { await discard(stream); return fail(writer() ? 'superseded' : 'readonly'); }
          await stream.write(raw);
          // Se a aba perdeu a sessão ou a pasta foi desconectada, não confirma uma escrita atrasada.
          if (!usable(token, handle)) { await discard(stream); return fail(writer() ? 'superseded' : 'readonly'); }
          await stream.close(); stream = null;
          if (token === epoch && active === handle && !pending) { lastSaved = now(); phase = 'ready'; error = ''; notify(); }
          return { ok: true, file: FILE_NAME, lastSaved };
        } catch (cause) {
          await discard(stream);
          const message = failure(cause, 'Não foi possível gravar a cópia na pasta.');
          if (token === epoch && active === handle && !pending && phase !== 'choosing') { phase = cause && cause.name === 'NotAllowedError' ? 'permission' : 'error'; error = message; notify(); }
          return fail('error', message);
        } finally {
          if (token === epoch && active === handle && phase === 'saving') { phase = 'ready'; notify(); }
        }
      });
      writeTail = operation.catch(() => fail('error', 'Não foi possível gravar a cópia local.'));
      return writeTail;
    }
    function snapshot() {
      try { return typeof options.getSnapshot === 'function' ? options.getSnapshot() : null; } catch (e) { return null; }
    }

    B.status = () => ({ supported, phase, folder: (pending ? pending.handle : active) && (pending ? pending.handle : active).name || '', lastSaved, error: error || rememberError });
    B.init = async function () {
      if (!supported) return fail('unsupported');
      const token = epoch;
      try {
        const saved = await storage.get(key);
        if (token !== epoch) return fail('superseded');
        if (!saved || typeof saved.getFileHandle !== 'function') return { ok: true, connected: false };
        active = saved; error = ''; rememberError = '';
        const granted = await permission(active, false);
        if (token !== epoch) return fail('superseded');
        phase = granted ? 'ready' : 'permission'; notify();
        return { ok: true, connected: true, permission: granted };
      } catch (cause) {
        if (token === epoch) { rememberError = 'Não foi possível recuperar a pasta lembrada. Escolha uma pasta novamente para manter a cópia local.'; notify(); }
        return fail('storage', rememberError);
      }
    };
    B.choose = async function () {
      if (!supported) return fail('unsupported', 'Este navegador não permite escolher uma pasta. Use Baixar cópia.');
      if (!writer()) return fail('readonly');
      // Primeira operação do clique: o seletor precisa da ativação do usuário.
      const token = ++epoch; pending = null; phase = 'choosing'; error = ''; notify();
      try {
        const handle = await picker({ mode: 'readwrite', id: 'helios-idle-backup' });
        if (token !== epoch || !writer()) return fail(writer() ? 'superseded' : 'readonly');
        if (!await permission(handle, true)) { restorePhase(); notify(); return fail('permission', 'A pasta não foi autorizada. Seu salvamento no navegador continua disponível.'); }
        if (token !== epoch || !writer()) return fail(writer() ? 'superseded' : 'readonly');
        let raw = null;
        try {
          const file = await (await handle.getFileHandle(FILE_NAME, { create: false })).getFile();
          if (file.size > 5 * 1024 * 1024) { restorePhase(); notify(); return fail('file', 'O arquivo existente é grande demais para ser lido como uma partida. Escolha outra pasta.'); }
          raw = await file.text();
        } catch (cause) { if (!cause || cause.name !== 'NotFoundError') throw cause; }
        if (token !== epoch || !writer()) return fail(writer() ? 'superseded' : 'readonly');
        pending = { handle, existing: raw !== null }; phase = 'review'; notify();
        if (raw !== null) return { ok: true, existing: true, raw };
        const result = await B.confirmFolder({ overwrite: true });
        return Object.assign(result, { existing: false });
      } catch (cause) {
        if (token === epoch) { pending = null; restorePhase(); error = cause && cause.name === 'AbortError' ? '' : failure(cause, 'Não foi possível selecionar a pasta.'); notify(); }
        return fail(cause && cause.name === 'AbortError' ? 'cancelled' : 'error', error);
      }
    };
    B.confirmFolder = async function (decision) {
      if (!pending || phase !== 'review') return fail('no-choice');
      if (!decision || decision.overwrite !== true) return fail('review', 'Confirme qual partida deve ficar nesta pasta.');
      if (!writer()) return fail('readonly');
      const handle = pending.handle, token = epoch;
      active = handle; pending = null; lastSaved = 0; phase = 'ready'; error = ''; notify();
      const remembered = remember(handle);
      const result = await enqueue(snapshot(), token, handle);
      result.remembered = await remembered;
      return result;
    };
    B.cancelChoice = function () {
      ++epoch; pending = null; error = ''; restorePhase(); notify();
      return { ok: true };
    };
    B.authorize = async function () {
      if (!active) return fail('no-folder');
      if (pending || phase === 'review' || phase === 'choosing') return fail('review');
      if (!writer()) return fail('readonly');
      const handle = active, token = epoch;
      const granted = await permission(handle, true);
      if (token !== epoch || active !== handle) return fail('superseded');
      phase = granted ? 'ready' : 'permission'; error = ''; notify();
      return granted ? { ok: true } : fail('permission', 'A pasta não foi autorizada. O jogo continua salvo no navegador.');
    };
    B.schedule = async function (raw) {
      if (!active) return fail(supported ? 'no-folder' : 'unsupported');
      if (pending || phase === 'review' || phase === 'choosing') return fail('review');
      return enqueue(raw, epoch, active);
    };
    B.saveNow = async function () {
      const authorized = await B.authorize();
      if (!authorized.ok) return authorized;
      return enqueue(snapshot(), epoch, active);
    };
    B.disconnect = async function () {
      ++epoch; active = null; pending = null; lastSaved = 0; error = ''; restorePhase(); notify();
      const forgotten = remember(null);
      await writeTail;
      return { ok: true, remembered: await forgotten };
    };
    return B;
  };
})(typeof window !== 'undefined' ? (window.H = window.H || {}) : (globalThis.H = globalThis.H || {}), typeof window !== 'undefined' ? window : globalThis);
