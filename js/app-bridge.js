/* HELIOS IDLE — integração com o aplicativo (Capacitor). Na versão web este arquivo não faz nada.
   No aplicativo:
   - Armazenamento persistente: o save continua no localStorage do WebView (código síncrono do jogo) e é
     espelhado no armazenamento nativo (Capacitor Preferences). Ao abrir, se o espelho nativo tiver uma revisão
     mais nova e válida (ex.: o sistema limpou os dados do WebView), ele é restaurado antes de o jogo começar.
     Nada é apagado: o save atual do localStorage é a origem da primeira cópia (migração segura).
   - Segundo plano: ao sair, contabiliza o tempo pendente e salva; ao voltar, o laço normal aplica o tempo
     ausente como offline (sem depender de execução contínua em segundo plano).
   - Botão Voltar do Android: fecha o painel aberto; fora da tela da região, volta para ela; na região,
     salva e minimiza o aplicativo. */
(function (H) {
  'use strict';
  const cap = window.Capacitor;
  H.isApp = !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
  if (!H.isApp) return;
  const P = cap.Plugins && cap.Plugins.Preferences; const App = cap.Plugins && cap.Plugins.App;
  const E = H.E, D = H.DATA;
  const keyOf = () => D.SAVE_KEY; // main.js pode acrescentar o sufixo de ?slot=
  const local = { get: (k) => { try { return window.localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { window.localStorage.setItem(k, v); return true; } catch (e) { return false; } } };

  // antes do início: restaura do espelho nativo se ele for mais novo e válido
  H.bootGate = (async () => {
    if (!P) return;
    try {
      const { value } = await P.get({ key: keyOf() });
      if (!value) return;
      const cur = local.get(keyOf());
      if (E.peekRev(value) > E.peekRev(cur) && E.deserialize(value).ok) {
        if (cur) local.set(keyOf() + '_antes_restauracao_' + Date.now(), cur); // guarda o que havia
        local.set(keyOf(), value);
      }
    } catch (e) { /* sem armazenamento nativo: segue só com o localStorage */ }
  })();

  // depois de cada gravação bem-sucedida: espelha no armazenamento nativo (assíncrono, agrupado)
  let pend = null;
  H.onSaved = function () {
    if (!P || pend) return;
    pend = setTimeout(() => { pend = null; const v = local.get(keyOf()); if (v) P.set({ key: keyOf(), value: v }).catch(() => {}); }, 400);
  };

  if (App) {
    App.addListener('appStateChange', ({ isActive }) => {
      if (!H.lifecycle) return;
      if (isActive) H.lifecycle.resume(); else { H.lifecycle.pause(); const v = local.get(keyOf()); if (P && v) P.set({ key: keyOf(), value: v }).catch(() => {}); }
    });
    App.addListener('backButton', () => {
      const UI = H.UI;
      if (H.lockShown && H.lockShown()) return;
      if (UI.st.modalOpen) { if (!UI.st.modalLock) UI.closeModal(); return; }
      if (UI.st.screen !== 'region') { UI.go('region'); return; }
      if (H.lifecycle) H.lifecycle.pause();
      App.minimizeApp();
    });
  }
})(window.H = window.H || {});
