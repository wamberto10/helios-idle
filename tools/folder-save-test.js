/* Testa a pasta de saves com permissões e arquivos em memória. Nunca toca no disco do jogador. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert/strict');
const context = {}; vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/folder-save.js'), 'utf8'), context);
const make = context.H.makeFolderSave;
let checks = 0;
const check = (condition, message) => { checks++; assert.ok(condition, message); };
const error = name => Object.assign(new Error(name), { name });
const gate = () => { let release; return { promise: new Promise(r => { release = r; }), release: () => release() }; };
function directory(name, initial) {
  const files = new Map(initial === undefined ? [] : [['helios-idle-save.json', initial]]);
  const cfg = { permission: 'granted', authorize: 'granted', requests: 0, writes: 0, fail: false, pause: null, started: null };
  return { name, files, cfg,
    queryPermission: async () => cfg.permission,
    requestPermission: async () => { cfg.requests++; cfg.permission = cfg.authorize; return cfg.permission; },
    getFileHandle: async (file, opts) => {
      if (!files.has(file) && !opts.create) throw error('NotFoundError');
      return {
        getFile: async () => ({ size: (files.get(file) || '').length, text: async () => files.get(file) }),
        createWritable: async () => {
          let draft, aborted = false;
          return { write: async raw => { cfg.writes++; if (cfg.started) cfg.started.release(); if (cfg.pause) await cfg.pause.promise; if (cfg.fail) throw error('QuotaExceededError'); draft = raw; },
            close: async () => { if (!aborted) files.set(file, draft); }, abort: async () => { aborted = true; } };
        }
      };
    }
  };
}
function fixture(dir, opts = {}) {
  const memory = new Map(); let snapshot = 'snapshot-0', writer = true;
  const store = { get: async key => memory.get(key), set: async (key, value) => memory.set(key, value), remove: async key => memory.delete(key) };
  const env = { showDirectoryPicker: opts.picker === undefined ? async () => dir : opts.picker, handleStore: opts.store || store, now: () => 1234 };
  const b = make({ key: 'test-profile', env, getSnapshot: () => snapshot, isWriter: () => writer });
  return { b, memory, env, snapshot: value => { snapshot = value; }, writer: value => { writer = value; } };
}
async function main() {
  const unsupported = fixture(null, { picker: null });
  check(!unsupported.b.status().supported && (await unsupported.b.choose()).reason === 'unsupported', 'navegador sem API informa fallback');
  const d = directory('Saves'), f = fixture(d);
  check((await f.b.choose()).ok && d.files.get('helios-idle-save.json') === 'snapshot-0', 'pasta nova recebe o snapshot atual');
  check(f.memory.get('test-profile') === d && f.b.status().folder === 'Saves', 'pasta lembrada por chave da partida');
  await f.b.schedule('autosave-1'); await f.b.schedule('autosave-2');
  check(d.files.get('helios-idle-save.json') === 'autosave-2' && f.b.status().lastSaved === 1234, 'autosaves atualizam o arquivo em ordem');
  const old = directory('Outro jogador', 'save-importante'), existing = fixture(old);
  const found = await existing.b.choose();
  check(found.ok && found.existing && found.raw === 'save-importante', 'arquivo preexistente é apresentado para revisão');
  check(existing.b.status().phase === 'review' && old.cfg.writes === 0, 'escolher pasta existente não sobrescreve nada');
  check(!(await existing.b.confirmFolder({ overwrite: false })).ok && old.cfg.writes === 0, 'confirmação explícita exigida');
  check((await existing.b.schedule('indevido')).reason === 'no-folder' && old.cfg.writes === 0, 'autosave não grava durante revisão');
  existing.b.cancelChoice();
  check(old.files.get('helios-idle-save.json') === 'save-importante' && existing.b.status().phase === 'idle', 'cancelar preserva o arquivo anterior');
  await existing.b.choose(); existing.snapshot('partida-restaurada'); await existing.b.confirmFolder({ overwrite: true });
  check(old.files.get('helios-idle-save.json') === 'partida-restaurada', 'confirmar usa o snapshot depois da restauração');
  old.cfg.permission = 'prompt';
  const reopened = make({ key: 'test-profile', env: existing.env, getSnapshot: () => 'reaberto', isWriter: () => true });
  await reopened.init();
  check(reopened.status().phase === 'permission' && old.cfg.requests === 0, 'reabrir consulta permissão sem mostrar pedido');
  check((await reopened.schedule('silencioso')).reason === 'permission' && old.cfg.requests === 0, 'autosave sem permissão não abre diálogo');
  check((await reopened.saveNow()).ok && old.cfg.requests === 1 && old.files.get('helios-idle-save.json') === 'reaberto', 'salvar por clique pode reautorizar a pasta');
  old.cfg.permission = 'denied'; old.cfg.authorize = 'denied';
  check(!(await reopened.saveNow()).ok && old.files.get('helios-idle-save.json') === 'reaberto', 'negar permissão mantém a cópia existente');
  const cancelled = fixture(d, { picker: async () => { throw error('AbortError'); } });
  check((await cancelled.b.choose()).reason === 'cancelled' && cancelled.b.status().phase === 'idle', 'cancelar seletor não é falha de salvamento');
  d.cfg.fail = true;
  check(!(await f.b.schedule('falha')).ok && d.files.get('helios-idle-save.json') === 'autosave-2', 'erro de escrita aborta e preserva arquivo anterior');
  check(f.b.status().phase === 'error' && !!f.b.status().error, 'falha de disco fica visível no status');
  d.cfg.fail = false;
  check((await f.b.schedule('recuperado')).ok, 'autosave recupera após falha temporária');
  const locked = directory('Bloqueado'), inactive = fixture(locked); inactive.writer(false);
  check((await inactive.b.choose()).reason === 'readonly' && locked.cfg.requests === 0, 'aba de leitura não seleciona ou escreve');
  f.writer(false);
  check((await f.b.schedule('aba-antiga')).reason === 'readonly' && d.files.get('helios-idle-save.json') === 'recuperado', 'aba antiga não grava sobre a atual');
  f.writer(true);
  d.cfg.pause = gate(); d.cfg.started = gate();
  const late = f.b.schedule('escrita-atrasada'); await d.cfg.started.promise;
  const disconnected = f.b.disconnect(); d.cfg.pause.release(); await late; await disconnected;
  check(d.files.get('helios-idle-save.json') === 'recuperado', 'desconectar aborta escrita pendente sem apagar cópia');
  check(!f.memory.has('test-profile') && !f.b.status().folder, 'desconectar esquece a seleção');
  check((await f.b.schedule('futuro')).reason === 'no-folder', 'desconectar impede gravações futuras');
  const queueDir = directory('Fila'), queued = fixture(queueDir); await queued.b.choose();
  queueDir.cfg.pause = gate(); queueDir.cfg.started = gate();
  const a = queued.b.schedule('primeiro'); await queueDir.cfg.started.promise;
  const b = queued.b.schedule('segundo'); queueDir.cfg.pause.release(); await a; await b;
  check(queueDir.files.get('helios-idle-save.json') === 'segundo', 'fila não permite que snapshot antigo ultrapasse o novo');
  queueDir.cfg.pause = gate(); queueDir.cfg.started = gate();
  const lost = queued.b.schedule('posse-perdida'); await queueDir.cfg.started.promise; queued.writer(false); queueDir.cfg.pause.release(); await lost;
  check(queueDir.files.get('helios-idle-save.json') === 'segundo', 'perder posse durante escrita impede confirmação do arquivo');
  const noDB = directory('Sem IndexedDB'), fallback = fixture(noDB, { store: { get: async () => null, set: async () => { throw error('SecurityError'); }, remove: async () => {} } });
  const remembered = await fallback.b.choose();
  check(remembered.ok && !remembered.remembered && !!fallback.b.status().error && noDB.files.has('helios-idle-save.json'), 'falha de IndexedDB mantém cópia e avisa que pasta não foi lembrada');
  console.log('Pasta de saves: ' + checks + ' verificações OK.');
}
main().catch(e => { console.error(e); process.exitCode = 1; });
