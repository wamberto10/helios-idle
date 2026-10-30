/* HELIOS IDLE — inicialização, laço principal, salvamento, som e efeitos. */
(function (H) {
  'use strict';
  const { DATA: D, E, F, UI } = H;
  let S;

  // ---------------- SOM (Web Audio, sem arquivos) ----------------
  let ctx = null;
  H.audioUnlock = function () { if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ctx = null; } } if (ctx && ctx.state === 'suspended') ctx.resume(); };
  function tone(f, t0, dur, type, vol) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type || 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0, ctx.currentTime + t0); g.gain.linearRampToValueAtTime(vol || 0.06, ctx.currentTime + t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t0 + dur); o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + t0); o.stop(ctx.currentTime + t0 + dur + 0.02);
  }
  const SOUNDS = {
    click: () => tone(660, 0, 0.05, 'triangle', 0.03),
    buy: () => { tone(520, 0, 0.08, 'triangle'); tone(780, 0.06, 0.1, 'triangle'); },
    claim: () => { tone(660, 0, 0.1); tone(880, 0.08, 0.1); tone(1320, 0.16, 0.18); },
    chest: () => { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, i * 0.06, 0.25, 'sine', 0.05)); },
    promote: () => { [392, 523, 659, 784].forEach((f, i) => tone(f, i * 0.09, 0.3, 'triangle', 0.06)); },
    err: () => tone(160, 0, 0.18, 'sawtooth', 0.03),
    collapse: () => { tone(110, 0, 2.4, 'sawtooth', 0.04); tone(55, 0.4, 2.6, 'sine', 0.08); tone(880, 2.6, 1.2, 'sine', 0.05); },
  };
  H.SFX = { play: (n) => { if (!S || !S.settings.sound || !ctx) return; try { SOUNDS[n] && SOUNDS[n](); } catch (e) { /* ignora */ } } };

  // ---------------- SALVAMENTO ----------------
  // ?slot=nome usa uma partida separada (testes automáticos não tocam no salvamento pessoal)
  const slot = new URLSearchParams(location.search).get('slot');
  if (slot && /^[\w-]{1,40}$/.test(slot)) D.SAVE_KEY = D.SAVE_KEY + '__' + slot;
  const store = H.store = H.safeStorage(() => window.localStorage);
  const ses = H.session = H.makeSession({ storage: store, key: D.SAVE_KEY, onLost: (why) => { running = false; showLock(why); } });
  H.folderSave = H.makeFolderSave({ key: D.SAVE_KEY, getSnapshot: () => E.serialize(S), isWriter: () => ses.role === 'writer' && !ses.protect });
  let lastSave = 0; let running = false;
  H.saveState = { failing: false, reason: '' };
  const SAVE_MSG = {
    quota: 'o armazenamento do navegador está cheio',
    blocked: 'o navegador bloqueou o armazenamento local',
    protected: 'o salvamento anterior com problema foi preservado e não será sobrescrito',
  };
  // Resultado explícito: { ok, status: 'saved' | 'scheduled' | 'readonly' | 'stale' | 'error', reason?, msg? }
  H.save = function (force, manual) {
    if (!S) return { ok: false, status: 'error', reason: 'blocked', msg: SAVE_MSG.blocked };
    if (ses.role !== 'writer') return { ok: false, status: ses.lost === 'stale' ? 'stale' : 'readonly' };
    const now = Date.now();
    if (!force && now - lastSave < 800) { H._pendingSave = true; return { ok: true, status: 'scheduled' }; }
    lastSave = now; H._pendingSave = false;
    const r = ses.write(S);
    if (r.ok) {
      if (H.saveState.failing) { H.saveState.failing = false; if (!manual) UI.toast('Salvamento restabelecido.', 'ok'); }
    } else if (r.status === 'error') {
      r.msg = SAVE_MSG[r.reason] || SAVE_MSG.blocked;
      if (!H.saveState.failing && !manual) UI.toast('Não foi possível salvar: ' + r.msg + '. A partida continua; use Ajustes → Exportar para guardar uma cópia.', 'err');
      H.saveState.failing = true; H.saveState.reason = r.reason;
    }
    if (S.profile && (r.ok || r.status === 'error') && !ses.protect) H.folderSave.schedule(E.serialize(S));
    if (r.ok && H.onSaved) H.onSaved(); // aplicativo: espelho no armazenamento nativo
    return r;
  };
  H.saveMessage = function (r) {
    if (r.ok) return r.status === 'scheduled' ? 'Salvamento agendado.' : 'Jogo salvo.';
    if (r.status === 'readonly' || r.status === 'stale') return 'Esta aba está em modo de leitura: ela não grava para não sobrescrever o progresso de outra aba.';
    return 'Não foi possível salvar: ' + (r.msg || SAVE_MSG.blocked) + '. A partida continua aberta; use Exportar para guardar uma cópia.';
  };
  // Lê o salvamento. Um salvamento inválido é copiado à parte antes de qualquer gravação;
  // se a cópia falhar, o original fica protegido (esta aba não grava por cima).
  function load() {
    const raw = ses.readRaw();
    if (!raw) return { S: E.newState(), fresh: true };
    const r = E.deserialize(raw); // nunca lança exceção
    if (r.ok) return { S: r.S, from: r.from };
    let backup = null;
    try { const k = D.SAVE_KEY + '_corrompido_' + Date.now(); store.setItem(k, raw); backup = k; } catch (e) { ses.protect = true; }
    return { S: E.newState(), fresh: true, err: r.err, backup };
  }
  // Troca a partida (importação ou reinício) — chamada só depois da validação e da confirmação.
  // opts.offline: importação ou backup restaurado — credita o tempo desde o horário do arquivo (limite offline do
  // jogo). O intervalo fica registrado no lastTick e não é concedido de novo.
  H.replaceState = function (ns, opts) {
    if (ses.role !== 'writer') return { ok: false, status: 'readonly' };
    S = ns; const now = Date.now(); let rep = null;
    if (opts && opts.offline && typeof S.lastTick === 'number' && isFinite(S.lastTick) && S.lastTick < now) rep = E.applyOffline(S, now);
    else S.lastTick = now;
    H.applySettings(); UI.setState(S); UI.ensureProfile();
    const r = H.save(true, true); r.offline = rep;
    if (rep) UI.offlineReport(rep);
    return r;
  };
  // Contabiliza o tempo pendente antes de salvar ao fechar, ocultar ou transferir a aba: intervalos curtos são
  // simulados agora; longos (aba suspensa) ficam no lastTick antigo e são creditados uma vez ao voltar, como offline.
  function settle(now) {
    if (!S || !running || ses.role !== 'writer') return;
    const dt = (now - (S.lastTick || now)) / 1000;
    if (dt > 0 && dt <= 120) { S.lastTick = now; if (dt > 1) E.simulate(S, dt); else E.tick(S, dt); }
  }
  H._settle = settle;
  // movimento reduzido: ajuste do jogo ou preferência do sistema (vale para CSS e para as animações em JS)
  const mqReduce = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  H.reduceMotion = () => !!((S && S.settings.reduceMotion) || (mqReduce && mqReduce.matches));
  if (mqReduce && mqReduce.addEventListener) mqReduce.addEventListener('change', () => { if (S) document.body.classList.toggle('reduce-motion', H.reduceMotion()); });
  H.applySettings = function () {
    F.sci = !!S.settings.sci;
    document.body.classList.toggle('reduce-motion', H.reduceMotion());
    const u = D.universes[S.run.universe];
    document.documentElement.style.setProperty('--sun', u.sun);
    document.body.style.filter = '';
    document.documentElement.dataset.universe = S.run.universe;
    drawStars(u.hue);
  };

  // ---------------- FUNDO ESTRELADO ----------------
  function drawStars(hue) {
    const c = document.getElementById('stars'); if (!c) return;
    const w = c.width = document.documentElement.clientWidth, h = c.height = innerHeight; const g = c.getContext('2d');
    g.clearRect(0, 0, w, h); let seed = 42; const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let i = 0; i < Math.floor(w * h / 5000); i++) {
      const x = rnd() * w, y = rnd() * h, r = rnd() * 1.2 + 0.2;
      g.fillStyle = `hsla(${(210 + (hue || 0) + rnd() * 40) % 360},80%,${80 + rnd() * 20}%,${rnd() * 0.7 + 0.2})`;
      g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill();
    }
  }

  // ---------------- LAÇO ----------------
  let lastUi = 0, lastBeat = 0, lastCheck = 0, lastRaf = 0, lastFallback = 0;
  function step() {
    const now = Date.now();
    // sem quadros de animação (painel embutido oculto, navegador economizando): atualiza a interface pelo laço
    if (now - lastRaf > 1000 && now - lastFallback > 250 && document.visibilityState === 'visible' && S) { lastFallback = now; try { UI.frame(); } catch (e) { console.error(e); } }
    if (!running || ses.role !== 'writer') { if (now - lastCheck > 1000) { lastCheck = now; passiveCheck(); } return; }
    if (now - lastBeat > 2000) { lastBeat = now; ses.heartbeat(); if (ses.role !== 'writer') return; if (ses.pendingRequest()) { handOver(); return; } }
    const dt = (now - (S.lastTick || now)) / 1000;
    if (dt > 120) { // computador dormiu / aba suspensa: trata como offline
      const rep = E.applyOffline(S, now); if (rep) UI.offlineReport(rep);
    } else if (dt > 0) {
      S.lastTick = now;
      if (dt > 1) E.simulate(S, dt); else E.tick(S, dt);
    }
    if (H._pendingSave) H.save();
    // falha temporária: tenta de novo em 5s; normal: a cada AUTOSAVE_SEC
    if (now - lastSave > (H.saveState.failing ? 5000 : D.AUTOSAVE_SEC * 1000)) H.save(true);
  }

  // ---------------- ABAS ----------------
  const LOCK_TXT = {
    other: ['Partida aberta em outra aba', 'Só uma aba por vez joga e salva, para que uma aba antiga não apague progresso mais recente. Esta aba está em modo de leitura.', 'Usar esta aba'],
    taken: ['A partida continuou em outra aba', 'Esta aba parou de salvar para não sobrescrever o progresso mais recente.', 'Voltar a jogar nesta aba'],
    moved: ['A partida continuou em outra aba', 'O progresso desta aba foi salvo e passado para a outra aba. Esta aba agora só exibe.', 'Voltar a jogar nesta aba'],
    stale: ['Esta aba está desatualizada', 'Outra aba salvou um progresso mais recente. Esta aba não vai gravar por cima dele.', 'Carregar o progresso mais recente'],
  };
  function showLock(why) {
    running = false;
    let ov = document.getElementById('lockov');
    if (!ov) { ov = document.createElement('div'); ov.id = 'lockov'; document.body.appendChild(ov); }
    const t = LOCK_TXT[why] || LOCK_TXT.other;
    ov.innerHTML = `<div class="modal lock" role="dialog" aria-modal="true" aria-labelledby="lockov-t" aria-describedby="lockov-d"><h2 id="lockov-t">${t[0]}</h2><p id="lockov-d" class="small">${t[1]}</p>
      <p class="tiny muted">Ao fechar a outra aba, esta continua automaticamente.</p><div class="foot"><button class="btn gold" id="lockov-b" data-why="${why}">${t[2]}</button></div></div>`;
    ov.classList.add('on'); ov.dataset.why = why;
    setInert(true);
    const b = document.getElementById('lockov-b'); b.onclick = () => requestTakeover(b);
    setTimeout(() => { if (ov.classList.contains('on')) b.focus(); }, 30);
  }
  function hideLock() { const ov = document.getElementById('lockov'); if (ov) { ov.classList.remove('on'); ov.innerHTML = ''; } setInert(false); }
  function setInert(on) {
    for (const id of ['app', 'modal', 'toasts']) { const el = document.getElementById(id); if (el) { if (on || (id === 'app' && UI.st.modalOpen)) el.setAttribute('inert', ''); else el.removeAttribute('inert'); } }
  }
  H.lockShown = () => { const ov = document.getElementById('lockov'); return !!(ov && ov.classList.contains('on')); };
  // aba em modo de leitura: assume sozinha quando a gravadora fecha ou trava (se esta aba estiver visível)
  function passiveCheck() {
    if (document.visibilityState !== 'visible' || !S) return;
    const ls = ses.lockState(); if (ls === 'free' || ls === 'stale') takeOver(false);
  }
  function requestTakeover(btn) {
    if (btn) { btn.disabled = true; btn.textContent = 'Transferindo…'; }
    ses.requestRelease();
    const t0 = Date.now();
    const poll = setInterval(() => {
      const ls = ses.lockState();
      if (ls === 'free' || ls === 'stale' || Date.now() - t0 > 3000) {
        clearInterval(poll); ses.clearRequest();
        if (!takeOver(true) && btn && btn.isConnected) { btn.disabled = false; btn.textContent = 'Tentar de novo'; }
      }
    }, 100);
  }
  // outra aba pediu a partida: salva o progresso desta, libera a posse e passa a só exibir
  function handOver() { settle(Date.now()); H.save(true); running = false; ses.release(); showLock('moved'); }
  // assume a partida a partir da versão mais recente gravada (nunca do estado antigo desta aba)
  function takeOver(force) {
    if (!ses.claim(force)) return false;
    const L = load(); S = L.S; ses.rev = L.fresh ? ses.storedRev() : S.rev;
    UI.closeModal(true); UI.setState(S); H.applySettings(); hideLock();
    begin(L);
    return true;
  }
  // início da simulação nesta aba (só a aba gravadora chega aqui)
  function begin(L) {
    running = true; lastBeat = Date.now();
    if (L.err) UI.modal(`<h2 class="bad">Salvamento inválido</h2><p>${esc(L.err)}</p><p class="small muted">${L.backup ? 'O conteúdo original foi guardado à parte neste navegador (' + esc(L.backup) + ') para recuperação. Um novo jogo foi iniciado.' : 'Não foi possível guardar uma cópia, então o salvamento original foi mantido intacto e este novo jogo não será salvo por cima dele. Exporte o que precisar.'}</p><div class="foot"><button class="btn" data-a="close">Entendi</button></div>`);
    UI.ensureProfile();
    if (L.fresh) {
      S.lastTick = Date.now();
      UI.queueModal(() => UI.modal(`<h2>Missão Hélios</h2><p>O módulo <b>Aurora</b> pousou na Lua. Sua tarefa: extrair recursos, construir instalações, recrutar especialistas e expandir a operação por todo o Sistema Solar.</p>
        <p class="small muted">O grande objetivo é o <b class="gold">enxame de Dyson</b>. Depois dele… a anomalia em Netuno.</p>
        <p class="small">Comece tocando em <b>Operar</b> nos extratores e siga as três missões ativas.</p><div class="foot"><button class="btn gold" data-a="close" autofocus>Começar</button></div>`));
    } else {
      const rep = E.applyOffline(S, Date.now());
      if (rep) UI.offlineReport(rep);
    }
    H.save(true); // o intervalo offline fica registrado: não é concedido de novo, nem por outra aba
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function frame(ts) {
    lastRaf = Date.now();
    if (ts - lastUi > 110) { lastUi = ts; try { UI.frame(); } catch (e) { console.error(e); if (H._errors) H._errors.push(String(e && e.message || e)); } }
    requestAnimationFrame(frame);
  }

  // ---------------- COLAPSO (animação) ----------------
  H.collapse = function (uni) {
    const before = { frags: S.perm.frags };
    const sats = S.run.dyson.stage; const routes = S.run.routes.length;
    UI.st.holdEvents = true; // eventos (ex.: Eco recrutado) aparecem depois da animação
    const r = E.doCollapse(S, uni);
    if (!r.ok) { UI.st.holdEvents = false; UI.toast(r.err, 'err'); return; }
    S.lastTick = Date.now(); H.save(true);
    const finish = () => {
      H.applySettings(); UI.st.uniSel = null; UI.go('region', { rid: 'lua', rtab: 'prod' });
      const p = r.sum;
      UI.modal(`<h2 class="purple">Bem-vindo(a) ao ${D.universes[uni].name}</h2><p>${D.universes[uni].desc}</p><ul class="small">${D.universes[uni].traits.map((t) => '<li>' + t + '</li>').join('')}</ul>
        <p><span class="chip purple">+${r.frags} Fragmentos de Singularidade</span></p>
        ${p.missions || p.exps || p.dirs ? `<p class="small muted">Pendências resolvidas: ${p.missions} missão(ões) e ${p.dirs || 0} diretriz(es) creditada(s), ${p.exps} expedição(ões) encerrada(s), +${F.n(p.data)} dados${p.frags ? ', +' + p.frags + ' fragmento(s) de diretrizes' : ''}${p.disc && p.disc.length ? ', descoberta(s): ' + p.disc.map((d) => H.DATA.discoveries[d].name).join(', ') : ''}.</p>` : ''}${p.pend >= 1 ? `<p class="small muted">${H.F.n(p.pend)} unidade(s) de suprimentos que aguardavam espaço reiniciaram com os estoques.</p>` : ''}${p.cargo >= 1 ? `<p class="small muted">${F.n(p.cargo)} unidade(s) de carga que estavam a bordo reiniciaram junto com os estoques do universo anterior.</p>` : ''}
        <p class="small">Seus especialistas reassumem as funções automaticamente assim que as instalações voltarem a existir.</p><div class="foot"><button class="btn purple" data-a="close">Começar</button></div>`);
      UI.st.holdEvents = false; // agora o recrutamento de Eco entra na fila, depois desta tela
    };
    if (S.settings.skipAnim) { finish(); return; }
    H.SFX.play('collapse');
    playCollapseFx(sats, routes, D.universes[uni], finish);
  };
  function playCollapseFx(sats, routes, uni, done) {
    const c = document.getElementById('fx'); const skip = document.getElementById('fxskip');
    const probeArt = new Image(); const probeSrc = H.A.paths.ship('probe'); if (probeSrc) probeArt.src = probeSrc;
    const g = c.getContext('2d'); const w = c.width = innerWidth, h = c.height = innerHeight; const cx = w / 2, cy = h / 2;
    c.classList.add('on'); skip.classList.add('on');
    const reduce = H.reduceMotion(); const T = reduce ? 900 : 5200;
    const parts = []; const N = reduce ? 0 : 260 + sats * 30;
    for (let i = 0; i < N; i++) { const a = Math.random() * 6.283, r = 60 + Math.random() * Math.max(w, h) * 0.6; parts.push({ a, r, s: 0.6 + Math.random() * 1.6, c: Math.random() < 0.2 ? '#ffc857' : Math.random() < 0.5 ? '#3fe0ff' : '#b07cff' }); }
    const lines = []; for (let i = 0; i < Math.max(3, routes); i++) lines.push([Math.random() * 6.283, Math.random() * 6.283, 120 + Math.random() * 200]);
    const t0 = performance.now(); let stopped = false;
    const end = () => { if (stopped) return; stopped = true; c.classList.remove('on'); skip.classList.remove('on'); skip.onclick = null; done(); };
    skip.onclick = end;
    function draw(now) {
      if (stopped) return; const t = (now - t0) / T;
      if (t >= 1) { end(); return; }
      g.fillStyle = reduce ? `rgba(3,6,15,${Math.min(1, t * 2)})` : 'rgba(3,6,15,0.22)'; g.fillRect(0, 0, w, h);
      if (!reduce) {
        // 1) rotas se apagam
        if (t < 0.25) { g.strokeStyle = `rgba(63,224,255,${0.6 * (1 - t / 0.25)})`; g.lineWidth = 1.5; for (const [a, b, r] of lines) { g.beginPath(); g.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); g.lineTo(cx + Math.cos(b) * r, cy + Math.sin(b) * r); g.stroke(); } }
        // 2) estruturas viram rastros e convergem
        const k = Math.min(1, Math.max(0, (t - 0.1) / 0.55));
        for (const p of parts) {
          const rr = p.r * Math.pow(1 - k, 1.6); const aa = p.a + k * p.s * 6;
          const x = cx + Math.cos(aa) * rr, y = cy + Math.sin(aa) * rr;
          g.fillStyle = p.c; g.globalAlpha = 0.8 * (1 - Math.max(0, (t - 0.62) / 0.1)); g.fillRect(x, y, 2, 2); g.globalAlpha = 1;
        }
        // 3) singularidade
        if (t > 0.5 && t < 0.78) { const q = (t - 0.5) / 0.28; const R = 8 + q * 40; const gr = g.createRadialGradient(cx, cy, 0, cx, cy, R * 3); gr.addColorStop(0, '#000'); gr.addColorStop(0.3, '#000'); gr.addColorStop(0.45, '#b07cff'); gr.addColorStop(1, 'rgba(176,124,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, R * 3, 0, 6.283); g.fill(); }
        if (t > 0.74 && t < 0.82) { g.fillStyle = `rgba(230,210,255,${1 - Math.abs(t - 0.78) / 0.04})`; g.fillRect(0, 0, w, h); }
        // 4) a sonda emerge no novo universo
        if (t > 0.8) {
          const q = (t - 0.8) / 0.2;
          const gr = g.createRadialGradient(cx, cy, 0, cx, cy, 30 + q * 160); gr.addColorStop(0, uni.sun); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, 30 + q * 160, 0, 6.283); g.fill();
          g.strokeStyle = 'rgba(63,224,255,.8)'; g.beginPath(); g.arc(cx, cy, q * Math.max(w, h) * 0.5, 0, 6.283); g.stroke();
          g.save(); g.translate(cx + q * 120, cy - q * 60); g.rotate(-0.4);
          if (probeArt.complete && probeArt.naturalWidth) g.drawImage(probeArt, -30, -30, 60, 60);
          else { g.fillStyle = '#fff'; g.fillRect(-6, -2, 12, 4); g.fillStyle = '#3fe0ff'; g.fillRect(-12, -1, 6, 2); }
          g.restore();
          g.fillStyle = `rgba(232,240,255,${q})`; g.font = '700 22px "Exo 2", system-ui'; g.textAlign = 'center'; g.fillText(uni.name, cx, cy + 120);
        }
      }
      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
  }

  // ---------------- FERRAMENTAS DE DESENVOLVIMENTO ----------------
  H.dev = function (cmd) {
    if (!S.settings.dev) return;
    const rid = UI.st.rid; const reg = S.run.regions[rid];
    if (cmd[0] === 't') { const sec = +cmd.slice(1); const rep = E.simulate(S, sec); rep.away = rep.used = sec; if (sec >= 3600) UI.offlineReport(rep); else UI.toast('Simulados ' + F.t(sec) + '.'); }
    else if (cmd === 'res') { for (const r of D.resOrder) reg.st[r] = Math.min(E.cap(S, rid, r), (reg.st[r] || 0) + 1000); UI.toast('Recursos adicionados em ' + D.regions[rid].name + ' (até o limite).'); }
    else if (cmd === 'data') S.perm.data += 10000;
    else if (cmd === 'frag') { S.perm.frags += 10; S.perm.fragsTotal += 10; }
    else if (cmd === 'cards') for (const s in S.perm.specs) S.perm.specs[s].cards += 20;
    else if (cmd === 'missions') { for (const x of E.activeMissions(S, rid)) { S.run.missions[x.id] = 1; E.grant(S, rid, x.md.rw); } if (E.phaseMissions(S, rid).length && E.phaseMissions(S, rid).every((a) => a.claimed)) E.completePhase(S, rid); }
    else if (cmd === 'region') { const nr = D.regionOrder.find((r) => !S.run.regions[r].unlocked); if (nr) { const prev = D.regionOrder[D.regionOrder.indexOf(nr) - 1]; S.run.regions[prev].phase = D.regions[prev].phases.length; E.unlockRegion(S, nr); } }
    else if (cmd === 'dyson') { if (S.run.dyson.stage < D.dyson.length) { delete S.run.projects.dyson; S.run.dyson.stage++; } }
    else if (cmd === 'ready') { for (const r of D.regionOrder) { if (!S.run.regions[r].unlocked) E.unlockRegion(S, r); S.run.regions[r].phase = D.regions[r].phases.length; } S.run.dyson.stage = Math.max(S.run.dyson.stage, D.dysonRequired); S.run.core = true; S.run.totals.value = Math.max(S.run.totals.value, 5e7); }
    H.save(true); UI.frame(true);
  };

  // ---------------- INÍCIO ----------------
  function boot() {
    let L;
    try { L = load(); } catch (e) { L = { S: E.newState(), fresh: true, err: 'Erro inesperado ao ler o salvamento (' + (e && e.message) + ').' }; }
    S = L.S; ses.rev = L.fresh ? ses.storedRev() : S.rev;
    H.state = () => S; // acesso para depuração e testes
    try { H.applySettings(); } catch (e) { console.error(e); }
    UI.init(S);
    H.folderSave.init();
    if (!store.available()) { H.saveState.failing = true; H.saveState.reason = 'blocked'; UI.toast('Este navegador bloqueou o armazenamento local. A partida funciona, mas não será salva: use Ajustes → Exportar.', 'err'); }
    // posse da sessão: confirma depois de um instante (duas abas abertas ao mesmo tempo)
    if (ses.claim(false)) setTimeout(() => { if (ses.confirm()) begin(L); else showLock('other'); H.ready = true; }, 150);
    else { showLock('other'); H.ready = true; }
    stepTimer = setInterval(step, 100);
    requestAnimationFrame(frame);
    document.addEventListener('visibilitychange', () => { if (document.hidden) { if (running) { settle(Date.now()); H.save(true); } } else step(); });
    window.addEventListener('pagehide', () => { if (frozen) return; if (running) { settle(Date.now()); H.save(true); } running = false; ses.release(); });
    window.addEventListener('pageshow', (e) => { if (e.persisted) { running = false; ses.role = 'passive'; showLock('taken'); passiveCheck(); } });
    window.addEventListener('beforeunload', () => { if (running) { settle(Date.now()); H.save(true); } });
    window.addEventListener('storage', (e) => {
      if (e.key === ses.keys.req && running && ses.isReleaseRequest(e.newValue)) handOver();
      else if (e.key === ses.keys.lock && running) ses.heartbeat(); // perdeu a posse → onLost
      else if (e.key === ses.keys.save && running && ses.storedRev() > ses.rev) ses.lose('stale');
    });
    const isText = (t) => t && (t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && !/^(checkbox|radio|button|submit|range)$/i.test(t.type)));
    document.addEventListener('focusin', (e) => { if (isText(e.target)) document.body.classList.add('kbd'); });
    document.addEventListener('focusout', (e) => { if (isText(e.target)) setTimeout(() => { if (!isText(document.activeElement)) document.body.classList.remove('kbd'); }, 60); });
    let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => drawStars(D.universes[S.run.universe].hue), 200); });
  }
  let stepTimer = 0, frozen = false;
  // ganchos de teste (só numa partida separada, ?slot=): simular uma aba travada e coletar erros
  if (slot) {
    H._errors = [];
    window.addEventListener('error', (e) => H._errors.push(String(e.message)));
    window.addEventListener('unhandledrejection', (e) => H._errors.push(String(e.reason)));
    H._test = { freeze() { frozen = true; running = false; clearInterval(stepTimer); }, running: () => running,
      // aba suspensa pelo sistema: o laço para, mas a aba continua responsável (sem evento de fechamento)
      suspend() { clearInterval(stepTimer); }, resume() { clearInterval(stepTimer); stepTimer = setInterval(step, 100); step(); } };
  }
  // ciclo de vida (aplicativo): sair para o segundo plano salva; voltar aplica o tempo ausente pelo laço normal
  H.lifecycle = { pause() { if (running) { settle(Date.now()); H.save(true); } }, resume() { step(); } };
  H.boot = boot;
  // no aplicativo, app-bridge.js pode restaurar o save nativo antes do início (H.bootGate)
  const start = () => { if (H.bootGate && H.bootGate.then) H.bootGate.then(boot, boot); else boot(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})(window.H = window.H || {});
