/* Testa js/app-bridge.js com um Capacitor simulado (Node, sem celular). node tools/app-bridge-test.js */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let fails = 0, count = 0;
const ok = (c, msg) => { count++; if (!c) { fails++; console.log('  ✗ ' + msg); } };

function setup(native, local) {
  const store = Object.assign({}, local || {}); const nat = Object.assign({}, native || {});
  const listeners = {}; const calls = { minimize: 0, pause: 0, resume: 0, close: 0, go: [] };
  const win = {
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
    Capacitor: { isNativePlatform: () => true, Plugins: {
      Preferences: { get: async ({ key }) => ({ value: key in nat ? nat[key] : null }), set: async ({ key, value }) => { nat[key] = value; } },
      App: { addListener: (ev, fn) => { listeners[ev] = fn; }, minimizeApp: () => { calls.minimize++; } },
    } },
    setTimeout, clearTimeout,
  };
  const ctx = { window: win, console, setTimeout, clearTimeout, Math, JSON, Date, Promise };
  ctx.globalThis = ctx; vm.createContext(ctx);
  for (const f of ['data.js', 'engine.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8').replace(/typeof window !== 'undefined' \? \(window\.H = window\.H \|\| \{\}\) : /g, ''), ctx, { filename: f });
  win.H = ctx.H; ctx.H.UI = { st: { modalOpen: false, modalLock: false, screen: 'region' }, closeModal: () => { calls.close++; }, go: (s) => { calls.go.push(s); } };
  ctx.H.lifecycle = { pause: () => { calls.pause++; }, resume: () => { calls.resume++; } };
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'app-bridge.js'), 'utf8'), ctx, { filename: 'app-bridge.js' });
  return { H: ctx.H, store, nat, listeners, calls };
}
const save = (H, rev, data) => { const S = H.E.newState(); S.perm.data = data; S.rev = rev; return H.E.serialize(S); };

(async () => {
  console.log('Integração com o aplicativo (Capacitor simulado)');
  const K = 'helios_idle_save';
  let t = setup({}, {}); const S0 = save(t.H, 0, 0);
  // 1) espelho nativo mais novo e válido: restaurado antes do início, com cópia do que havia
  t = setup({ [K]: save(t.H, 9, 900) }, { [K]: save(t.H, 3, 300) }); await t.H.bootGate;
  ok(t.H.isApp && JSON.parse(t.store[K]).perm.data === 900, 'save nativo mais novo e válido é restaurado');
  ok(Object.keys(t.store).some((k) => k.startsWith(K + '_antes_restauracao_') && JSON.parse(t.store[k]).perm.data === 300), 'o save anterior do WebView é guardado à parte');
  // 2) espelho mais velho: nada muda
  t = setup({ [K]: save(t.H, 2, 200) }, { [K]: save(t.H, 5, 500) }); await t.H.bootGate;
  ok(JSON.parse(t.store[K]).perm.data === 500 && Object.keys(t.store).length === 1, 'espelho mais velho não sobrescreve o save do WebView');
  // 3) espelho inválido: ignorado
  t = setup({ [K]: '{"game":"helios-idle","v":3,"rev":99,"perm":"x"}' }, { [K]: save(t.H, 5, 500) }); await t.H.bootGate;
  ok(JSON.parse(t.store[K]).perm.data === 500, 'espelho inválido é ignorado (sem perda)');
  // 4) migração: primeira abertura sem espelho usa o save atual e o espelha após salvar
  t = setup({}, { [K]: save(t.H, 4, 400) }); await t.H.bootGate;
  ok(JSON.parse(t.store[K]).perm.data === 400, 'primeira abertura no app mantém o save atual');
  t.H.onSaved(); await new Promise((r) => setTimeout(r, 450)); ok(t.nat[K] && JSON.parse(t.nat[K]).perm.data === 400, 'cada gravação é espelhada no armazenamento nativo');
  // 5) segundo plano
  t.listeners.appStateChange({ isActive: false }); ok(t.calls.pause === 1, 'ir para o segundo plano salva (contabiliza o tempo pendente)');
  t.listeners.appStateChange({ isActive: true }); ok(t.calls.resume === 1, 'voltar ao app aplica o tempo ausente pelo laço normal');
  // 6) botão Voltar
  t.H.UI.st.modalOpen = true; t.listeners.backButton(); ok(t.calls.close === 1 && t.calls.minimize === 0, 'Voltar com painel aberto fecha o painel');
  t.H.UI.st.modalLock = true; t.listeners.backButton(); ok(t.calls.close === 1, 'painel obrigatório não fecha com Voltar');
  t.H.UI.st.modalOpen = false; t.H.UI.st.modalLock = false; t.H.UI.st.screen = 'research'; t.listeners.backButton(); ok(t.calls.go[0] === 'region', 'Voltar fora da Região volta para a Região');
  t.H.UI.st.screen = 'region'; t.listeners.backButton(); ok(t.calls.minimize === 1 && t.calls.pause === 2, 'Voltar na Região salva e minimiza');
  // 7) web: sem Capacitor nada é ativado
  const ctx = { window: { localStorage: {} }, console }; ctx.globalThis = ctx; vm.createContext(ctx); ctx.window.H = { E: {}, DATA: {} };
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'app-bridge.js'), 'utf8'), ctx);
  ok(ctx.window.H.isApp === false && !ctx.window.H.bootGate && !ctx.window.H.onSaved, 'na versão web o arquivo não faz nada');
  console.log('  ' + (count - fails) + '/' + count + ' verificações OK');
  process.exit(fails ? 1 : 0);
})();
