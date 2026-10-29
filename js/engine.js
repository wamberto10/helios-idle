/* HELIOS IDLE — motor de simulação (sem DOM). Roda no navegador e no Node (testes). */
(function (H) {
  'use strict';
  const D = H.DATA;
  const E = H.E = {};
  const RO = D.regionOrder;
  const EPS = 1e-9;

  // ================= FORMATAÇÃO =================
  const F = H.F = { sci: false };
  const SUF = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
  F.n = function (x, dec) {
    if (x === undefined || x === null || isNaN(x)) return '0';
    if (!isFinite(x)) return '∞';
    const neg = x < 0; x = Math.abs(x);
    let s;
    if (x < 1000) {
      if (dec !== undefined) s = x.toFixed(dec);
      else if (x < 10 && Math.abs(x - Math.round(x)) > 0.05) s = x.toFixed(1);
      else s = String(Math.floor(x + 1e-6));
    } else {
      const e = Math.floor(Math.log10(x));
      const tier = Math.floor(e / 3);
      if (F.sci || tier >= SUF.length) {
        s = (x / Math.pow(10, e)).toFixed(2) + 'e' + e;
      } else {
        const v = x / Math.pow(1000, tier);
        s = (v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : Math.floor(v).toString()) + SUF[tier];
      }
    }
    return (neg ? '−' : '') + s.replace('.', ',');
  };
  F.x = (v) => '×' + (v >= 100 ? F.n(v) : (Math.round(v * 100) / 100).toString().replace('.', ','));
  F.pct = (v) => Math.round(v * 100) + '%';
  F.t = function (sec) {
    sec = Math.max(0, Math.ceil(sec));
    if (sec < 60) return sec + 's';
    const m = Math.floor(sec / 60), s = sec % 60;
    if (m < 60) return m + 'm' + (s ? ' ' + String(s).padStart(2, '0') + 's' : '');
    const h = Math.floor(m / 60), mm = m % 60;
    return h + 'h ' + String(mm).padStart(2, '0') + 'm';
  };
  F.dur = (sec) => sec < 10 ? (Math.round(sec * 10) / 10).toString().replace('.', ',') + 's' : F.t(sec);

  // ================= RNG =================
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  E.rng = (S) => mulberry32((S.perm.seq = (S.perm.seq || 1) + 1) * 2654435761 + (S.perm.collapses + 7) * 97);

  // ================= ESTADO =================
  E.newPerm = () => ({
    data: 0, frags: 0, fragsTotal: 0, specs: {}, research: {}, ach: {}, universes: [], visited: { padrao: true },
    collapses: 0, chests: [], seq: 1, stats: { playSec: 0, value: 0 }, disc: {},
  });
  E.newRegion = () => ({ unlocked: false, phase: 0, b: {}, st: {}, pend: {}, rate: {}, flow: {}, exp: {}, en: { gen: 0, use: 0, ratio: 1 },
    stats: { prod: {}, cycles: {}, deliv: {}, data: 0, trips: 0 } });
  E.newRun = function (S, uni) {
    const run = { universe: uni || 'padrao', time: 0, regions: {}, missions: {}, projects: {}, routes: [], routeSeq: 0, routesBuilt: 0,
      dyson: { stage: 0, auto: true }, core: false, exps: [], expSeq: 0, totals: { value: 0, prod: {} }, counters: { exped: 0, trips: 0 },
      flags: {}, offer: null, dirs: {}, gpi: 0, log: [], started: Date.now() };
    RO.forEach((r) => { run.regions[r] = E.newRegion(); });
    const old = S.run; S.run = run;
    E.unlockRegion(S, 'lua', true);
    const m = E.mods(S);
    const lua = run.regions.lua;
    if (m.startKit > 0) for (const r in D.startKit) lua.st[r] = (lua.st[r] || 0) + D.startKit[r] * m.startKit;
    if (m.prefab > 0) {
      E.bs(lua, 'extrator').n += 2 * m.prefab; E.bs(lua, 'refinaria').n += m.prefab; E.bs(lua, 'painel').n += 2 * m.prefab;
    }
    for (const r in lua.st) lua.st[r] = Math.min(lua.st[r], E.cap(S, 'lua', r, m));
    S.run = old; return run;
  };
  E.newState = function () {
    const S = { profile: null, perm: E.newPerm(), settings: { sound: true, reduceMotion: false, sci: false, dev: false, skipAnim: false }, events: [] };
    S.run = E.newRun(S, 'padrao');
    E.log(S, 'story', 'Missão Hélios: estabelecer uma operação na Lua e expandir pelo Sistema Solar.');
    return S;
  };

  E.bs = function (reg, bid) {
    return reg.b[bid] || (reg.b[bid] = { n: 0, lvl: 1, p: 0, on: false, pause: false, why: '', blk: false });
  };

  // Perfil local: somente os campos validados entram no salvamento. Não é uma conta online.
  E.validateProfile = function (input) {
    try {
      if (!input || typeof input !== 'object' || Array.isArray(input) ||
          !Object.prototype.hasOwnProperty.call(input, 'name') || !Object.prototype.hasOwnProperty.call(input, 'avatar')) {
        return { ok: false, err: 'Informe um nome e escolha um avatar para o comandante.' };
      }
      const rawName = input.name, avatar = input.avatar;
      if (typeof rawName !== 'string') return { ok: false, err: 'O nome do comandante deve ser um texto.' };
      // Controles, caracteres invisíveis de formatação e fragmentos HTML não pertencem a um nome.
      if (/[\p{Cc}\p{Cf}\p{Cs}<>]/u.test(rawName)) return { ok: false, err: 'O nome não pode conter marcação HTML, controles ou caracteres invisíveis.' };
      const name = rawName.normalize('NFC').replace(/\s+/gu, ' ').trim();
      if ([...name].length < 2 || [...name].length > 24) return { ok: false, err: 'Use de 2 a 24 caracteres no nome do comandante.' };
      if (typeof avatar !== 'string' || !Object.prototype.hasOwnProperty.call(D.commanderAvatars, avatar)) {
        return { ok: false, err: 'Escolha um dos avatares disponíveis para o comandante.' };
      }
      return { ok: true, profile: { name, avatar } };
    } catch (e) {
      return { ok: false, err: 'Não foi possível ler o perfil. Informe o nome e escolha um avatar novamente.' };
    }
  };
  E.setProfile = function (S, input) {
    const result = E.validateProfile(input);
    if (!result.ok) return result;
    S.profile = result.profile;
    return result;
  };

  // ================= EVENTOS / LOG =================
  E.emit = function (S, kind, text, extra) { (S.events || (S.events = [])).push(Object.assign({ kind, text }, extra || {})); };
  E.log = function (S, kind, text) {
    S.run.log.unshift({ kind, text, t: S.run.time });
    if (S.run.log.length > 60) S.run.log.length = 60;
    E.emit(S, kind, text);
  };

  // ================= MODIFICADORES =================
  // Regras de combinação:
  //  - Velocidade: multiplicativa entre fontes (especialista × pesquisa × universo × global × energia).
  //  - Rendimento: nível da instalação × pesquisa (categoria) × pesquisa/universo (recurso) × Fragmentos.
  //  - Dentro de um mesmo nó de pesquisa os níveis somam (ex.: 3 níveis de +20% = +60%).
  E.mods = function (S) {
    const perm = S.perm, run = S.run;
    const um = (D.universes[run.universe] || D.universes.padrao).mods || {};
    const m = { speed: {}, yieldCat: {}, yieldRes: {}, useCat: {}, auto: {}, gen: 1, genSolar: 1, genReactor: 1, use: 1, storage: 1,
      cargo: 1, travel: 1, fuel: 1, costRed: 1, expReward: 1, expTime: 1, expSlots: 1, dataGain: 1, offlineH: D.OFFLINE_BASE_H,
      window: D.route.windowBonus, fragGain: 1, globalSpeed: 1, globalYield: 1 + D.collapse.fragYield * (perm.fragsTotal || 0),
      solar: um.solar || 1, dysonCost: um.dysonCost || 1, missionEase: 0, routeSpeed: 1, routeAuto: false, dysonAuto: false,
      startKit: 0, prefab: 0, offers: 3 };
    for (const c in D.cats) { m.speed[c] = 1; m.yieldCat[c] = 1; m.useCat[c] = 1; }
    for (const id in perm.research) {
      const lvl = perm.research[id]; const node = D.research[id]; if (!node || !lvl) continue;
      const e = node.eff, v = e.v * lvl;
      switch (e.k) {
        case 'speed': m.speed[e.cat] *= 1 + v; break;
        case 'yieldCat': m.yieldCat[e.cat] *= 1 + v; break;
        case 'yieldRes': m.yieldRes[e.res] = (m.yieldRes[e.res] || 1) * (1 + v); break;
        case 'gen': m.gen *= 1 + v; break;
        case 'genReactor': m.genReactor *= 1 + v; break;
        case 'use': m.use *= Math.max(0.2, 1 - v); break;
        case 'storage': m.storage *= 1 + v; break;
        case 'cargo': m.cargo *= 1 + v; break;
        case 'travel': m.travel *= Math.max(0.3, 1 - v); break;
        case 'fuel': m.fuel *= Math.max(0.3, 1 - v); break;
        case 'costRed': m.costRed *= Math.max(0.3, 1 - v); break;
        case 'expReward': m.expReward *= 1 + v; break;
        case 'expTime': m.expTime *= Math.max(0.3, 1 - v); break;
        case 'expSlots': m.expSlots += v; break;
        case 'dataGain': m.dataGain *= 1 + v; break;
        case 'offlineH': m.offlineH += v; break;
        case 'window': m.window += v; break;
        case 'fragGain': m.fragGain *= 1 + v; break;
        case 'globalSpeed': m.globalSpeed *= 1 + v; break;
        case 'missionEase': m.missionEase += v; break;
        case 'startKit': m.startKit += v; break;
        case 'prefab': m.prefab += v; break;
        case 'offers': m.offers += v; break;
      }
    }
    for (const sid in perm.specs) {
      const lvl = perm.specs[sid].lvl; const sp = D.specs[sid]; if (!sp) continue;
      if (D.cats[sp.cat]) { m.auto[sp.cat] = true; m.speed[sp.cat] *= D.specSpeed[lvl]; }
      if (sid === 'helio') m.genSolar *= 1 + 0.25 * lvl;
      if (sid === 'oraculo') m.dataGain *= 1 + 0.1 * lvl;
      if (sid === 'vega') { m.routeAuto = true; m.routeSpeed *= 1 + 0.5 * lvl; }
      if (sid === 'lumen') { m.gen *= 1 + 0.2 * lvl; m.dysonAuto = true; }
      if (sid === 'eco') { m.globalSpeed *= 1 + 0.15 * lvl; m.offlineH += 2; }
      if (sid === 'reliquia') { m.expReward *= 1 + 0.25 * lvl; m.expTime *= Math.max(0.5, 1 - 0.05 * lvl); }
    }
    if (um.yieldRes) for (const r in um.yieldRes) m.yieldRes[r] = (m.yieldRes[r] || 1) * um.yieldRes[r];
    if (um.speed) for (const c in um.speed) m.speed[c] *= um.speed[c];
    if (um.useCat) for (const c in um.useCat) m.useCat[c] *= um.useCat[c];
    if (um.expReward) m.expReward *= um.expReward;
    if (um.expTime) m.expTime *= um.expTime;
    m.gen *= 1 + D.dysonEnergyPerStage * run.dyson.stage;
    // ciência: escala própria (ver D.science)
    const orc = perm.specs.oraculo; const sc = D.science;
    m.sciSpeed = (orc ? sc.oracleSpeed[orc.lvl] : 1) * ((um.speed && um.speed.research) || 1) * Math.pow(m.globalSpeed, sc.globalSpeedExp);
    m.sciYield = 1 + Math.min(sc.fragBonusMax, sc.fragBonus * (perm.fragsTotal || 0));
    return m;
  };

  // ================= CONSULTAS =================
  E.cap = function (S, rid, r, m) {
    m = m || E.mods(S);
    const reg = S.run.regions[rid]; const a = reg.b.armazem;
    const bonus = a && a.n ? D.buildings.armazem.storage * a.n * D.levelYield(a.lvl) : 0;
    return Math.floor(D.res[r].cap * (1 + bonus) * m.storage);
  };
  E.bAvail = function (S, rid, bid) {
    const v = D.regions[rid].build[bid];
    if (v === undefined) return false;
    if (typeof v === 'number') return S.run.regions[rid].phase >= v;
    return !!(S.run.regions[v] && S.run.regions[v].unlocked);
  };
  // ordem dos cartões: Painel Solar e Armazém no topo; o resto na ordem de D.regions[rid].build
  const B_TOP = ['painel', 'armazem'];
  E.bList = (S, rid) => {
    const ids = Object.keys(D.regions[rid].build);
    const rank = (b) => B_TOP.includes(b) ? B_TOP.indexOf(b) - 10 : ids.indexOf(b);
    return ids.filter((b) => E.bAvail(S, rid, b)).sort((a, b) => rank(a) - rank(b));
  };
  E.bCost = function (S, rid, bid, m) {
    m = m || E.mods(S);
    const def = D.buildings[bid]; const n = (S.run.regions[rid].b[bid] || {}).n || 0; const c = {};
    for (const r in def.cost) c[r] = Math.ceil(def.cost[r] * Math.pow(def.g, n) * m.costRed);
    return c;
  };
  E.uCost = function (S, rid, bid, m) {
    m = m || E.mods(S);
    const def = D.buildings[bid]; const lvl = (S.run.regions[rid].b[bid] || {}).lvl || 1; const c = {};
    for (const [r, a, from] of def.up) if (lvl >= from) c[r] = Math.ceil(a * Math.pow(def.ug, lvl - 1) * m.costRed);
    return c;
  };
  E.afford = function (reg, cost) { for (const r in cost) if ((reg.st[r] || 0) + EPS < cost[r]) return false; return true; };
  E.pay = function (reg, cost) { for (const r in cost) reg.st[r] = Math.max(0, (reg.st[r] || 0) - cost[r]); };
  E.isAuto = (m, def) => !!m.auto[def.cat];
  E.solarFactor = (S, rid, m) => D.regions[rid].solar * m.solar * m.genSolar;
  E.genOf = function (S, rid, bid, m, n, lvl) {
    const def = D.buildings[bid]; if (!def.gen) return 0;
    let g = def.gen * n * D.levelYield(lvl) * m.gen;
    if (def.solar) g *= E.solarFactor(S, rid, m);
    if (bid === 'reator') g *= m.genReactor;
    return g;
  };
  E.useOf = (def, n, m) => (def.e || 0) * n * m.use * m.useCat[def.cat] * Math.pow(Math.max(1e-9, E.speedOf(def, m)), D.energySpeedExp);
  E.isSci = (def) => !!(def.out && def.out.data);
  E.speedOf = (def, m) => E.isSci(def) ? m.sciSpeed : m.speed[def.cat] * m.globalSpeed;
  E.yieldOf = (def, bs, r, m) => r === 'data' ? D.science.levelYield(bs.lvl) * (m.yieldRes.data || 1) * m.sciYield
    : D.levelYield(bs.lvl) * m.yieldCat[def.cat] * (m.yieldRes[r] || 1) * m.globalYield;
  // produção teórica por segundo (sem gargalos)
  E.bRate = function (S, rid, bid, m, extraN, extraLvl) {
    const def = D.buildings[bid]; const bs = S.run.regions[rid].b[bid] || { n: 0, lvl: 1 };
    const n = bs.n + (extraN || 0); const lvl = bs.lvl + (extraLvl || 0);
    if (def.passive) return 0;
    const sp = E.speedOf(def, m) * (E.isAuto(m, def) ? 1 : 1);
    const r = Object.keys(def.out)[0];
    return def.out[r] * n * E.yieldOf(def, { lvl }, r, m) * (r === 'data' ? m.dataGain : 1) * sp / def.t;
  };
  E.regionEnergy = function (S, rid, m) {
    const reg = S.run.regions[rid]; let gen = 0, use = 0;
    for (const bid in reg.b) {
      const bs = reg.b[bid]; if (!bs.n) continue; const def = D.buildings[bid];
      if (def.gen) gen += E.genOf(S, rid, bid, m, bs.n, bs.lvl);
      else if (!def.passive) {
        // automática: todas as máquinas; ciclo manual: só as máquinas pagas no início (parado se aguarda espaço)
        if (E.isAuto(m, def) && !bs.pause) use += E.useOf(def, bs.n, m);
        else if (bs.on && !E.manualWaiting(bs)) use += E.useOf(def, bs.mc ? bs.mc.n : bs.n, m);
      }
    }
    return { gen, use, ratio: use > EPS ? Math.min(1, gen / use) : 1 };
  };
  E.incoming = (S, rid, r) => S.run.routes.some((rt) => rt.to === rid && rt.res.includes(r) && (rt.st !== 'idle' || rt.auto));

  // ================= POSIÇÕES / ROTAS =================
  E.orbit = (rid) => (rid === 'lua' || rid === 'terra') ? D.earth : D.regions[rid];
  E.pos = function (rid, time) {
    const o = E.orbit(rid); const a = o.a0 + 2 * Math.PI * time / o.period;
    return { x: Math.cos(a) * o.au, y: Math.sin(a) * o.au, a };
  };
  E.routeInfo = function (S, rt, m, timeOverride) {
    m = m || E.mods(S); const R = D.route; const time = timeOverride !== undefined ? timeOverride : S.run.time;
    const p1 = E.pos(rt.from, time), p2 = E.pos(rt.to, time);
    const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
    const r1 = E.orbit(rt.from).au, r2 = E.orbit(rt.to).au;
    const dmin = Math.abs(r1 - r2), dmax = r1 + r2;
    const q = dmax - dmin > EPS ? Math.max(0, Math.min(1, (dmax - d) / (dmax - dmin))) : 1;
    const win = q >= R.windowQ; const wb = win ? Math.min(0.8, m.window) : 0;
    const cap = Math.floor(R.baseCap * Math.pow(R.capPerLvl, rt.lvl - 1) * m.cargo);
    const T = Math.max(3, (R.timeBase + R.timePerAU * d) * (1 - wb) * m.travel / m.routeSpeed);
    const fuel = Math.ceil((R.fuelBase + R.fuelPerAU * d) * Math.sqrt(cap / R.baseCap) * (1 - wb) * m.fuel);
    return { d, q, win, cap, T, fuel, wb };
  };
  // custo do cargueiro cresce com o número de rotas que já partem da mesma origem
  E.routeCost = function (S, m, from) {
    m = m || E.mods(S); const c = {};
    const n = from ? S.run.routes.filter((r) => r.from === from).length : 0;
    for (const r in D.route.cost) c[r] = Math.ceil(D.route.cost[r] * Math.pow(D.route.g, n) * m.costRed);
    return c;
  };
  E.routeUpCost = function (S, rt, m) {
    m = m || E.mods(S); const c = {};
    for (const [r, a, from] of D.route.up) if (rt.lvl >= from) c[r] = Math.ceil(a * Math.pow(D.route.ug, rt.lvl - 1) * m.costRed);
    return c;
  };

  // ================= TICK =================
  function addFlow(reg, r, v) { reg.flow[r] = (reg.flow[r] || 0) + v; }
  function limitCycles(S, rid, reg, def, bs, m) {
    let lim = Infinity, why = '';
    if (def.in) for (const r in def.in) {
      const rs = E.reserved(S, rid, r, m); const need = def.in[r] * bs.n;
      const c = Math.floor(Math.max(0, (reg.st[r] || 0) - rs) / need + EPS);
      if (c < lim) { lim = c; why = (rs > 0 && (reg.st[r] || 0) >= need ? 'hold:' : 'no:') + r; }
    }
    for (const r in def.out) {
      if (r === 'data' || reg.exp[r]) continue;
      const cap = E.localCap(S, rid, r, m); const st = reg.st[r] || 0;
      if (st >= cap - EPS) { lim = 0; why = 'full:' + r; break; }
      const per = def.out[r] * bs.n * E.yieldOf(def, bs, r, m);
      const c = Math.ceil((cap - st) / per - EPS);
      if (c < lim) { lim = c; why = 'full:' + r; }
    }
    return { n: lim, why };
  }
  function consume(reg, def, n) {
    if (!def.in) return;
    for (const r in def.in) { const a = def.in[r] * n; reg.st[r] = Math.max(0, (reg.st[r] || 0) - a); addFlow(reg, r, -a); }
  }
  // contabiliza produção efetiva (estoque ou exportação): missões, valor do Colapso e relatório
  function credit(S, reg, r, made, rep) {
    if (!(made > 0)) return;
    const run = S.run;
    reg.stats.prod[r] = (reg.stats.prod[r] || 0) + made;
    run.totals.prod[r] = (run.totals.prod[r] || 0) + made;
    run.totals.value += made * D.res[r].v; S.perm.stats.value += made * D.res[r].v;
    if (rep) rep.prod[r] = (rep.prod[r] || 0) + made;
  }
  function creditData(S, reg, g, rep) { if (!(g > 0)) return; S.perm.data += g; reg.stats.data += g; if (rep) rep.data += g; }
  function exportGain(S, reg, r, amt, m, rep) {
    const g = amt * D.res[r].v * D.exportRate * m.dataGain; if (!(g > 0)) return;
    S.perm.data += g; reg.stats.export = (reg.stats.export || 0) + g; if (rep) rep.data += g;
  }
  // Ciclo manual: no início ficam registradas as máquinas (n) e o nível (lvl) pagos com os insumos.
  // Construções e melhorias feitas durante o ciclo valem a partir do ciclo seguinte; pesquisa e
  // universo valem no momento da entrega. Se o armazenamento estiver cheio, o produto espera.
  function manualAmounts(def, bs, m) {
    const o = {}; const lk = { lvl: bs.mc.lvl };
    for (const r in def.out) o[r] = def.out[r] * bs.mc.n * E.yieldOf(def, lk, r, m) * (r === 'data' ? m.dataGain : 1);
    return o;
  }
  function finishManual(S, rid, reg, bid, def, bs, m, rep) {
    const mc = bs.mc;
    if (!mc.left) { mc.left = manualAmounts(def, bs, m); reg.stats.cycles[bid] = (reg.stats.cycles[bid] || 0) + 1; }
    let wait = '';
    for (const r of Object.keys(mc.left)) {
      const amt = mc.left[r];
      if (!(amt > EPS)) { delete mc.left[r]; continue; }
      if (r === 'data') { creditData(S, reg, amt, rep); delete mc.left[r]; continue; }
      const cap = E.localCap(S, rid, r, m); const st = reg.st[r] || 0;
      const add = Math.max(0, Math.min(amt, cap - st));
      reg.st[r] = st + add; addFlow(reg, r, add);
      if (reg.exp[r]) { exportGain(S, reg, r, amt - add, m, rep); credit(S, reg, r, amt, rep); delete mc.left[r]; continue; }
      credit(S, reg, r, add, rep);
      if (amt - add > EPS) { mc.left[r] = amt - add; wait = wait || 'full:' + r; } else delete mc.left[r];
    }
    if (wait) { bs.why = wait; bs.blk = true; return false; }
    bs.on = false; bs.p = 0; delete bs.mc; bs.why = ''; bs.blk = false;
    return true;
  }
  E.manualWaiting = (bs) => !!(bs && bs.on && bs.mc && bs.mc.left);
  // Instalações automatizadas: modelo de fluxo contínuo resolvido por passo.
  // Cada instalação quer rodar k = dt / T ciclos; um fator f ∈ [0,1] reduz quem ficaria sem insumo
  // ou estouraria o armazenamento. Produção e consumo do passo são aplicados juntos (saldo líquido
  // por recurso), então um estoque intermediário cheio não descarta o que é consumido no mesmo passo.
  // suprimentos de recompensa que não couberam: entram no estoque assim que houver espaço (não contam como produção)
  function flushPending(S, rid, m) {
    const reg = S.run.regions[rid]; if (!reg.pend) return;
    for (const r of Object.keys(reg.pend)) {
      const add = Math.max(0, Math.min(reg.pend[r], E.localCap(S, rid, r, m) - (reg.st[r] || 0)));
      if (add > 0) { reg.st[r] = (reg.st[r] || 0) + add; reg.pend[r] -= add; addFlow(reg, r, add); }
      if (!(reg.pend[r] > EPS)) delete reg.pend[r];
    }
  }
  E.pendingTotal = (reg) => Object.values(reg.pend || {}).reduce((a, b) => a + b, 0);
  function regionTick(S, rid, dt, m, rep) {
    const reg = S.run.regions[rid];
    flushPending(S, rid, m); holdTick(S, rid, m);
    const en = E.regionEnergy(S, rid, m); reg.en = en; const ratio = en.ratio;
    const ids = Object.keys(reg.b).sort((a, b) => D.buildings[a].tier - D.buildings[b].tier);
    const auto = [];
    for (const bid of ids) {
      const bs = reg.b[bid]; const def = D.buildings[bid];
      if (!bs.n || def.passive) continue;
      const speed = E.speedOf(def, m) * ratio;
      const T = speed > EPS ? def.t / speed : Infinity;
      let t = dt;
      if (bs.on) { // ciclo manual em andamento: discreto (insumos já consumidos no início)
        if (!bs.mc) bs.mc = { n: bs.n, lvl: bs.lvl };
        if (bs.mc.left) { // produto pronto aguardando espaço
          if (!finishManual(S, rid, reg, bid, def, bs, m, rep)) continue;
        } else {
          if (!isFinite(T)) { bs.why = 'energy'; continue; }
          const rem = (1 - bs.p) * T;
          if (t < rem) { bs.p += t / T; bs.why = ratio < 1 ? 'energylow' : ''; continue; }
          t -= rem; bs.p = 1;
          if (!finishManual(S, rid, reg, bid, def, bs, m, rep)) continue;
        }
      }
      if (!(E.isAuto(m, def) && !bs.pause)) { bs.why = bs.pause ? 'paused' : 'manual'; bs.blk = false; continue; }
      if (!isFinite(T)) { bs.why = 'energy'; bs.blk = true; continue; }
      const y = {}; for (const r in def.out) y[r] = def.out[r] * bs.n * E.yieldOf(def, bs, r, m);
      auto.push({ bid, bs, def, k: t / T, f: 1, why: '', y });
    }
    if (auto.length) {
      const resv = E.holdCost(S, rid, m) || {};
      const resSet = new Set();
      for (const a of auto) { for (const r in (a.def.in || {})) resSet.add(r); for (const r in a.def.out) if (r !== 'data') resSet.add(r); }
      for (let it = 0; it < 40; it++) {
        let changed = false;
        for (const r of resSet) {
          let prod = 0, cons = 0;
          for (const a of auto) {
            if (a.y[r]) prod += a.y[r] * a.k * a.f;
            if (a.def.in && a.def.in[r]) cons += a.def.in[r] * a.bs.n * a.k * a.f;
          }
          const s = reg.st[r] || 0; const floor = Math.min(resv[r] || 0, s + prod); // material reservado não é consumido
          if (cons > EPS && s + prod - cons < floor - 1e-7) {
            const g = Math.max(0, (s + prod - floor) / cons);
            for (const a of auto) if (a.def.in && a.def.in[r] && a.f > 0) { a.f *= g; a.why = (floor > 0 && s + prod - (resv[r] || 0) < cons ? 'hold:' : 'no:') + r; changed = true; }
          } else if (!reg.exp[r] && prod > EPS) {
            const cap = E.localCap(S, rid, r, m);
            if (s + prod - cons > cap + 1e-7) {
              const g = Math.max(0, (cap - s + cons) / prod);
              for (const a of auto) if (a.y[r] && a.f > 0) { a.f *= g; a.why = 'full:' + r; changed = true; }
            }
          }
        }
        if (!changed) break;
      }
      // aplica o passo inteiro de uma vez: saldo líquido por recurso
      const net = {}, made = {};
      for (const a of auto) {
        const c = a.k * a.f; const bs = a.bs;
        if (c > 1e-12) {
          for (const r in (a.def.in || {})) net[r] = (net[r] || 0) - a.def.in[r] * bs.n * c;
          for (const r in a.y) {
            const amt = a.y[r] * c;
            if (r === 'data') creditData(S, reg, amt * m.dataGain, rep);
            else { net[r] = (net[r] || 0) + amt; made[r] = (made[r] || 0) + amt; }
          }
          reg.stats.cycles[a.bid] = (reg.stats.cycles[a.bid] || 0) + c;
          bs.p = (bs.p + c) % 1;
        }
        const lim = a.f < 0.98;
        bs.blk = a.f < 0.02; bs.why = lim ? a.why : (ratio < 1 ? 'energylow' : '');
        bs.eff = a.f;
      }
      for (const r in net) {
        const s = reg.st[r] || 0; let ns = s + net[r]; let mk = made[r] || 0;
        if (ns < 0) ns = 0; // resíduo numérico do solucionador
        const cap = Math.max(E.localCap(S, rid, r, m), s); // nunca abaixo do que já existe
        if (ns > cap) {
          const over = ns - cap; ns = cap;
          if (reg.exp[r]) exportGain(S, reg, r, over, m, rep); // excedente exportado conta como produzido
          else mk = Math.max(0, mk - over); // só resíduo numérico: não conta o que não coube
        }
        reg.st[r] = ns; addFlow(reg, r, ns - s);
        credit(S, reg, r, mk, rep);
      }
    }
    for (const bid of ids) {
      const bs = reg.b[bid]; const def = D.buildings[bid];
      if (!bs.n || def.passive) continue;
      if (rep && bs.why && bs.why !== 'manual' && bs.why !== 'paused' && E.isAuto(m, def)) {
        const k = rid + '|' + bid + '|' + bs.why; rep.stall[k] = (rep.stall[k] || 0) + dt;
      }
    }
  }
  function routeDepart(S, rt, m) {
    const run = S.run; const from = run.regions[rt.from], to = run.regions[rt.to];
    const info = E.routeInfo(S, rt, m);
    const rsv = (r) => E.reserved(S, rt.from, r, m);
    if ((from.st.fuel || 0) - rsv('fuel') + EPS < info.fuel) { rt.why = 'nofuel'; return false; }
    let left = info.cap; const cargo = {}; let tot = 0, anyAvail = false;
    for (const r of rt.res) {
      const avail = (from.st[r] || 0) - (r === 'fuel' ? info.fuel : 0) - (rt.reserve || 0) - rsv(r);
      if (avail >= 1) anyAvail = true;
      // espaço livre no destino descontando cargas que já estão a caminho (reserva de capacidade)
      // destino com “Exportar excedente” ligado aceita tudo (o que não couber segue para a Terra)
      const space = to.exp[r] ? Infinity : E.cap(S, rt.to, r, m) - (to.st[r] || 0) - E.inbound(S, rt.to, r, rt);
      const amt = Math.floor(Math.min(avail, left, space) + EPS);
      if (amt > 0) { cargo[r] = amt; left -= amt; tot += amt; }
    }
    if (tot <= 0) { rt.why = anyAvail ? 'destfull' : 'empty'; return false; }
    from.st.fuel = Math.max(0, from.st.fuel - info.fuel); addFlow(from, 'fuel', -info.fuel);
    for (const r in cargo) { from.st[r] = Math.max(0, from.st[r] - cargo[r]); addFlow(from, r, -cargo[r]); }
    rt.cargo = cargo; rt.st = 'out'; rt.t = 0; rt.T = info.T; rt.why = ''; rt.win = info.win;
    return true;
  }
  E.routeDepart = routeDepart;
  // carga a caminho de uma região (em viagem ou aguardando descarga)
  E.inbound = function (S, rid, r, except) {
    let s = 0;
    for (const rt of S.run.routes) if (rt !== except && rt.to === rid && (rt.st === 'out' || rt.st === 'wait')) s += rt.cargo[r] || 0;
    return s;
  };
  // limite para a produção local e recompensas: o espaço reservado para cargas a caminho fica livre
  E.localCap = (S, rid, r, m) => E.cap(S, rid, r, m) - E.inbound(S, rid, r);
  E.cargoTotal = (rt) => Object.values(rt.cargo || {}).reduce((a, b) => a + b, 0);
  // Descarrega o que couber. O saldo continua no cargueiro (estado 'wait') até haver espaço.
  // Só o que entra de fato no estoque conta como entrega. Devolve true quando o porão esvazia.
  function routeUnload(S, rt, m, rep) {
    const run = S.run; const to = run.regions[rt.to]; const from = run.regions[rt.from];
    for (const r of Object.keys(rt.cargo)) {
      const cap = E.cap(S, rt.to, r, m); const st = to.st[r] || 0;
      const add = Math.max(0, Math.min(rt.cargo[r], cap - st));
      if (add > 0) {
        to.st[r] = st + add; addFlow(to, r, add);
        to.stats.deliv[r] = (to.stats.deliv[r] || 0) + add;
        if (rep) rep.deliv[r] = (rep.deliv[r] || 0) + add;
      }
      let rest = rt.cargo[r] - add;
      if (rest > EPS && to.exp[r]) { // excedente declarado pelo jogador: exportado, registrado na rota
        exportGain(S, to, r, rest, m, rep); rt.exported = (rt.exported || 0) + rest; rest = 0;
      }
      if (rest > EPS) rt.cargo[r] = rest; else delete rt.cargo[r];
    }
    if (Object.keys(rt.cargo).length) { rt.st = 'wait'; rt.why = 'destwait'; return false; }
    to.stats.trips++; from.stats.trips++; run.counters.trips++; rt.trips = (rt.trips || 0) + 1;
    rt.st = 'back'; rt.t = 0; rt.why = '';
    return true;
  }
  function routeTick(S, rt, dt, m, rep) {
    let t = dt, guard = 0;
    while (guard++ < 200) {
      if (rt.st === 'idle') {
        if (m.routeAuto && rt.auto) { if (!routeDepart(S, rt, m)) break; } else break;
      }
      if (rt.st === 'wait') { if (!routeUnload(S, rt, m, rep)) break; continue; }
      const rem = rt.T - rt.t;
      if (t < rem) { rt.t += t; break; }
      t -= rem;
      if (rt.st === 'out') { rt.t = rt.T; if (!routeUnload(S, rt, m, rep)) break; }
      else { rt.st = 'idle'; rt.t = 0; }
      if (t <= EPS && rt.st === 'idle' && !(m.routeAuto && rt.auto)) break;
    }
  }
  E.tick = function (S, dt, rep) {
    if (!(dt > 0)) return;
    const run = S.run; const m = E.mods(S);
    run.time += dt; S.perm.stats.playSec += dt;
    for (const rid of RO) { const reg = run.regions[rid]; if (reg.unlocked) reg.flow = {}; }
    // cargueiros parados no destino descarregam antes da produção local ocupar o espaço liberado
    for (const rt of run.routes) if (rt.st === 'wait') routeUnload(S, rt, m, rep);
    for (const rid of RO) {
      const reg = run.regions[rid]; if (!reg.unlocked) continue;
      regionTick(S, rid, dt, m, rep);
    }
    for (const rt of run.routes) routeTick(S, rt, dt, m, rep);
    // contribuição automática ao enxame (Lúmen)
    if (m.dysonAuto && run.dyson.auto && E.projectInfo(S, 'dyson').avail) E.contribute(S, 'dyson', true);
    // taxas (média móvel)
    const a = Math.min(1, dt / 4);
    for (const rid of RO) {
      const reg = run.regions[rid]; if (!reg.unlocked) continue;
      const keys = new Set(Object.keys(reg.flow).concat(Object.keys(reg.rate)));
      for (const r of keys) { const f = (reg.flow[r] || 0) / dt; reg.rate[r] = (reg.rate[r] || 0) + (f - (reg.rate[r] || 0)) * a; if (Math.abs(reg.rate[r]) < 1e-4) reg.rate[r] = 0; }
    }
    E.checkAch(S);
  };

  // ================= AÇÕES: INSTALAÇÕES =================
  E.build = function (S, rid, bid) {
    const reg = S.run.regions[rid]; if (!reg.unlocked || !E.bAvail(S, rid, bid)) return { ok: false, err: 'Indisponível' };
    const cost = E.bCost(S, rid, bid); if (!E.afford(reg, cost)) return { ok: false, err: 'Recursos insuficientes' };
    E.pay(reg, cost); const bs = E.bs(reg, bid); bs.n++; bs.blk = false;
    return { ok: true };
  };
  // ================= RESERVA PARA MELHORIA =================
  // Uma reserva por região: o custo da próxima melhoria da instalação escolhida vira um piso no estoque.
  // Consumidores da região, rotas que saem dela e entregas a projetos não usam esse material; quando o custo
  // completa, a melhoria acontece uma vez (pagando) e a reserva termina. Construir e melhorar manualmente
  // continuam livres (são escolhas explícitas do jogador).
  E.holdCost = function (S, rid, m) {
    const reg = S.run.regions[rid]; const h = reg.hold; if (!h) return null;
    const bs = reg.b[h.bid]; if (!bs || !bs.n || bs.lvl >= D.maxBuildingLevel) return null;
    return E.uCost(S, rid, h.bid, m);
  };
  E.reserved = (S, rid, r, m) => { const c = E.holdCost(S, rid, m); return c && c[r] ? c[r] : 0; };
  E.setHold = function (S, rid, bid) {
    const reg = S.run.regions[rid]; if (!reg) return { ok: false };
    if (reg.hold && reg.hold.bid === bid) { delete reg.hold; return { ok: true, on: false }; }
    const bs = reg.b[bid]; if (!bs || !bs.n) return { ok: false, err: 'Construa primeiro' };
    if (bs.lvl >= D.maxBuildingLevel) return { ok: false, err: 'Nível máximo' };
    reg.hold = { bid }; for (const b in reg.b) reg.b[b].blk = false;
    return { ok: true, on: true };
  };
  function holdTick(S, rid, m) {
    const reg = S.run.regions[rid]; if (!reg.hold) return;
    const bid = reg.hold.bid; const bs = reg.b[bid];
    if (!bs || !bs.n || bs.lvl >= D.maxBuildingLevel) { delete reg.hold; return; }
    if (E.afford(reg, E.uCost(S, rid, bid, m)) && E.upgrade(S, rid, bid).ok) {
      delete reg.hold;
      E.log(S, 'gold', D.buildings[bid].name + ' (' + D.regions[rid].name + ') melhorado(a) ao nível ' + bs.lvl + ' com o material reservado.');
    }
  }
  E.upgrade = function (S, rid, bid) {
    const reg = S.run.regions[rid]; const bs = reg.b[bid];
    if (!bs || !bs.n) return { ok: false, err: 'Construa primeiro' };
    if (bs.lvl >= D.maxBuildingLevel) return { ok: false, err: 'Nível máximo' };
    const cost = E.uCost(S, rid, bid); if (!E.afford(reg, cost)) return { ok: false, err: 'Recursos insuficientes' };
    E.pay(reg, cost); bs.lvl++; bs.blk = false;
    return { ok: true };
  };
  // ciclo manual
  E.operate = function (S, rid, bid) {
    const reg = S.run.regions[rid]; const bs = reg.b[bid]; const def = D.buildings[bid]; const m = E.mods(S);
    if (!bs || !bs.n || def.passive) return { ok: false };
    if (bs.on) return { ok: false, err: 'Em operação' };
    const lim = limitCycles(S, rid, reg, def, bs, m);
    if (lim.n < 1) { bs.why = lim.why; return { ok: false, err: E.whyText(S, rid, lim.why) }; }
    consume(reg, def, bs.n); bs.on = true; bs.p = 0; bs.why = ''; bs.blk = false;
    bs.mc = { n: bs.n, lvl: bs.lvl }; // o ciclo entrega o que foi pago agora
    return { ok: true };
  };
  E.toggleExport = function (S, rid, r) { const reg = S.run.regions[rid]; reg.exp[r] = !reg.exp[r]; if (!reg.exp[r]) delete reg.exp[r]; for (const b in reg.b) reg.b[b].blk = false; };
  E.togglePause = function (S, rid, bid) { const bs = S.run.regions[rid].b[bid]; if (bs) { bs.pause = !bs.pause; bs.blk = false; } };

  E.whyText = function (S, rid, why) {
    if (!why) return '';
    if (why === 'energy') return 'Energia insuficiente';
    if (why === 'energylow') return 'Limitada por energia';
    if (why === 'paused') return 'Pausada';
    if (why === 'manual') return 'Aguardando comando';
    const [k, r] = why.split(':');
    if (k === 'no') {
      if (E.incoming(S, rid, r)) return 'Aguardando transporte (' + D.res[r].name.toLowerCase().replace('dyson', 'Dyson') + ')';
      const sp = E.surplusFor(S, rid, r);
      return 'Sem ' + D.res[r].name.toLowerCase().replace('dyson', 'Dyson') + (sp ? ' — sobrando em ' + D.regions[sp.rid].name : '');
    }
    if (k === 'full') return 'Armazenamento cheio (' + D.res[r].name.toLowerCase().replace('dyson', 'Dyson') + ')';
    if (k === 'hold') return 'Material reservado para melhoria (' + D.res[r].name.toLowerCase().replace('dyson', 'Dyson') + ')';
    return why;
  };
  // outra região com sobra do recurso (estoque acima de metade da capacidade ou exportando): fonte sugerida para uma rota
  E.surplusFor = function (S, rid, r, m) {
    m = m || E.mods(S); let best = null;
    for (const o of RO) {
      if (o === rid) continue; const reg = S.run.regions[o]; if (!reg || !reg.unlocked) continue;
      const st = reg.st[r] || 0; if (st < 1) continue;
      const cap = E.cap(S, o, r, m); if (!(st >= cap * 0.5 || reg.exp[r])) continue;
      const score = st / cap + (reg.exp[r] ? 1 : 0);
      if (!best || score > best.score) best = { rid: o, st, score };
    }
    if (!best) return null;
    const rt = S.run.routes.find((x) => x.from === best.rid && x.to === rid && x.res.includes(r));
    return { rid: best.rid, st: best.st, route: rt ? rt.id : null };
  };
  E.routeWhyText = function (why) {
    return { nofuel: 'Sem combustível na origem', empty: 'Sem carga disponível', destfull: 'Destino cheio', destwait: 'Aguardando espaço no destino' }[why] || '';
  };

  // gargalo principal da região
  E.bottleneck = function (S, rid) {
    const reg = S.run.regions[rid]; const m = E.mods(S);
    if (reg.en.ratio < 0.999) return { kind: 'energy', text: 'Energia insuficiente: ' + F.n(reg.en.gen) + ' / ' + F.n(reg.en.use) + ' MW', hint: 'Construa ou melhore geradores. Instalações ficam mais lentas (' + F.pct(reg.en.ratio) + '). Sem material para geradores? Pause as instalações de transformação para a extração e o refino voltarem à velocidade.' };
    const ids = Object.keys(reg.b).filter((b) => reg.b[b].n && !D.buildings[b].passive).sort((a, b) => D.buildings[b].tier - D.buildings[a].tier);
    for (const bid of ids) {
      const bs = reg.b[bid]; if (!bs.blk || !bs.why) continue;
      const [k, r] = bs.why.split(':');
      const name = D.buildings[bid].name;
      if (k === 'no') {
        const rn = D.res[r].name.toLowerCase().replace('dyson', 'Dyson'); const sp = E.surplusFor(S, rid, r, m);
        if (sp) {
          const path = D.regions[sp.rid].name + ' → ' + D.regions[rid].name;
          return { kind: 'input', bid, res: r, src: sp.rid, route: sp.route, text: name + ': ' + E.whyText(S, rid, bs.why),
            hint: D.res[r].name + ' sobrando em ' + D.regions[sp.rid].name + ' (' + F.n(sp.st) + '). ' + (sp.route !== null ? 'Melhore o cargueiro ' + path + ' ou adicione outro.' : 'Crie uma rota ' + path + '.') };
        }
        return { kind: 'input', bid, res: r, text: name + ': ' + E.whyText(S, rid, bs.why), hint: 'Aumente a produção de ' + rn + ' ou traga por rota.' };
      }
      if (k === 'hold') { const hb = reg.hold && D.buildings[reg.hold.bid]; return { kind: 'input', bid, res: r, text: name + ': ' + E.whyText(S, rid, bs.why), hint: 'Juntando ' + D.res[r].name.toLowerCase() + ' para melhorar ' + (hb ? hb.name : 'a instalação reservada') + '. A melhoria acontece sozinha quando o custo completar; cancele a reserva no cartão para liberar o material.' }; }
      if (k === 'full') return { kind: 'full', bid, text: name + ': ' + E.whyText(S, rid, bs.why), hint: 'Construa armazéns, transporte ' + D.res[r].name.toLowerCase().replace('dyson', 'Dyson') + ' por rota ou ative “Exportar excedente” no estoque.' };
    }
    const manual = ids.filter((b) => !E.isAuto(m, D.buildings[b]));
    if (manual.length) return { kind: 'manual', bid: manual[0], text: 'Operação manual: ' + manual.map((b) => D.buildings[b].name).join(', '), hint: 'Toque em “Operar” ou recrute o especialista da categoria para automatizar.' };
    return { kind: 'ok', text: 'Operação estável', hint: 'Todas as instalações automatizadas estão funcionando.' };
  };

  // ================= PROJETOS (pagamentos parciais) =================
  E.nextRegion = (rid) => RO[RO.indexOf(rid) + 1];
  E.regionDone = (S, rid) => S.run.regions[rid].phase >= D.regions[rid].phases.length;
  E.projectInfo = function (S, key) {
    const run = S.run; const m = E.mods(S);
    if (key === 'dyson') {
      const st = run.dyson.stage; if (st >= D.dyson.length) return { avail: false, done: true };
      const c = {}; for (const r in D.dyson[st]) c[r] = Math.ceil(D.dyson[st][r] * m.dysonCost);
      return { avail: run.regions[D.dysonRegion].unlocked && run.regions[D.dysonRegion].phase >= 1, rid: D.dysonRegion, cost: c, name: 'Enxame de Dyson — etapa ' + (st + 1) };
    }
    if (key === 'core') {
      const reg = run.regions[D.core.region];
      return { avail: !run.core && reg.unlocked && reg.phase >= D.core.minPhase, done: run.core, rid: D.core.region, cost: D.core.cost, name: 'Núcleo da Singularidade' };
    }
    if (key.startsWith('launch:')) {
      const to = key.slice(7); const from = RO[RO.indexOf(to) - 1];
      return { avail: !run.regions[to].unlocked && E.regionDone(S, from), done: run.regions[to].unlocked, rid: from, cost: D.regions[to].launch.cost, name: 'Expedição a ' + D.regions[to].name };
    }
    if (key.startsWith('m:')) {
      const id = key.slice(2); const [rid, ph, i] = id.split('.'); const md = D.regions[rid].phases[+ph].missions[+i];
      return { avail: !run.missions[id] && run.regions[rid].phase === +ph, rid, cost: md.cost, name: md.title };
    }
    return { avail: false };
  };
  E.projectProgress = function (S, key, cost) {
    const st = S.run.projects[key] || {}; let have = 0, need = 0;
    for (const r in cost) { have += Math.min(st[r] || 0, cost[r]); need += cost[r]; }
    return { have, need, st, done: have >= need - EPS };
  };
  E.contribute = function (S, key, silent) {
    const info = E.projectInfo(S, key); if (!info.avail) return { ok: false };
    const reg = S.run.regions[info.rid]; const st = S.run.projects[key] || (S.run.projects[key] = {});
    let gave = 0;
    for (const r in info.cost) {
      const need = info.cost[r] - (st[r] || 0); if (need <= EPS) continue;
      const give = Math.min(need, Math.max(0, (reg.st[r] || 0) - E.reserved(S, info.rid, r))); if (give <= EPS) continue;
      reg.st[r] -= give; st[r] = (st[r] || 0) + give; gave += give;
    }
    const pr = E.projectProgress(S, key, info.cost);
    if (pr.done) E.projectComplete(S, key);
    else if (!gave && !silent) { const h = reg.hold && D.buildings[reg.hold.bid]; return { ok: false, err: 'Nada disponível para entregar em ' + D.regions[info.rid].name + (h && Object.keys(info.cost).some((r) => E.reserved(S, info.rid, r) > 0) ? ' (parte do material está reservada para melhorar ' + h.name + ')' : '') }; }
    return { ok: true, done: pr.done };
  };
  E.projectComplete = function (S, key) {
    const run = S.run;
    if (key === 'dyson') {
      delete run.projects.dyson; run.dyson.stage++;
      E.log(S, 'gold', 'Enxame de Dyson: etapa ' + run.dyson.stage + ' concluída. Novos satélites orbitam o Sol (+' + Math.round(D.dysonEnergyPerStage * 100) + '% de energia em todas as regiões).');
      if (run.dyson.stage === D.dysonRequired) {
        E.log(S, 'gold', 'O enxame de Dyson está completo. A energia do Sol é nossa.');
        if (!S.perm.specs.lumen) { E.recruit(S, 'lumen'); }
      }
    } else if (key === 'core') {
      delete run.projects.core; run.core = true;
      E.log(S, 'purple', 'O Núcleo da Singularidade pulsa em órbita de Netuno. O Colapso é possível.');
    } else if (key.startsWith('launch:')) {
      delete run.projects[key]; E.unlockRegion(S, key.slice(7));
    } else if (key.startsWith('m:')) {
      run.projects[key].__done = 1;
    }
  };
  E.unlockRegion = function (S, rid, initial) {
    const reg = S.run.regions[rid]; if (reg.unlocked) return;
    const def = D.regions[rid]; reg.unlocked = true; reg.phase = 0;
    for (const b in def.start.b) E.bs(reg, b).n += def.start.b[b];
    for (const r in def.start.st) reg.st[r] = (reg.st[r] || 0) + def.start.st[r];
    if (!initial) {
      E.log(S, 'story', 'Chegamos a ' + def.name + '. ' + def.phases[0].story);
      E.emit(S, 'region', def.name, { rid });
    }
  };

  // ================= MISSÕES =================
  E.mid = (rid, ph, i) => rid + '.' + ph + '.' + i;
  E.mTitle = function (md) {
    if (md.title) return md.title;
    const n = F.n(md.n);
    switch (md.t) {
      case 'build': return 'Construir ' + n + ' ' + (md.n === 1 ? D.buildings[md.b].name.toLowerCase().replace('dyson', 'Dyson') : D.buildings[md.b].pl);
      case 'level': return 'Melhorar ' + D.buildings[md.b].name.toLowerCase().replace('dyson', 'Dyson') + ' até o nível ' + md.n;
      case 'prod': return 'Produzir ' + n + ' ' + D.res[md.r].pl;
      case 'cycles': return 'Operar ' + D.buildings[md.b].pl + ' ' + n + ' vezes';
      case 'energy': return 'Gerar ' + n + ' MW de energia';
      case 'route': return md.n === 1 ? 'Estabelecer uma rota de transporte' : 'Ter ' + n + ' rotas ligadas à região';
      case 'deliver': return 'Receber ' + n + ' ' + D.res[md.r].pl + ' por rotas';
      case 'ship': return 'Completar ' + n + ' viagens de carga';
      case 'exped': return 'Concluir ' + n + (md.n === 1 ? ' expedição' : ' expedições') + ' (total)';
      case 'research': return md.n === 1 ? 'Pesquisar uma tecnologia' : 'Ter ' + n + ' níveis de pesquisa';
      case 'promote': return 'Promover um especialista ao nível ' + md.n;
      case 'dyson': return 'Concluir a etapa ' + md.n + ' do enxame de Dyson';
      case 'total': return 'Ter ' + n + ' instalações na região';
      case 'data': return 'Gerar ' + n + ' dados de pesquisa na região';
      case 'core': return 'Construir o Núcleo da Singularidade';
      case 'tprod': return 'Produzir ' + n + ' ' + D.res[md.r].pl + ' no universo';
      case 'tenergy': return 'Gerar ' + n + ' MW somando todas as regiões';
      case 'hasSpec': return 'Recrutar ' + D.specs[md.s].name;
    }
    return '?';
  };
  E.depthMult = (S) => Math.min(D.collapse.depthMax, 1 + D.collapse.depthTarget * S.perm.collapses);
  E.mTarget = function (S, rid, md, m) {
    let n = md.n;
    if (rid && ['prod', 'deliver', 'cycles', 'data'].includes(md.t) && !(md.rw && md.rw.spec)) n = Math.ceil(n * E.depthMult(S));
    if (m.missionEase > 0 && (rid === 'lua' || rid === 'marte') && ['prod', 'cycles', 'deliver', 'ship'].includes(md.t)) n = Math.max(1, Math.ceil(n * (1 - Math.min(0.6, m.missionEase))));
    return n;
  };
  E.mProg = function (S, rid, md, id, m) {
    m = m || E.mods(S); const run = S.run; const reg = rid ? run.regions[rid] : null;
    const max = md.t === 'pay' ? 1 : E.mTarget(S, rid, md, m);
    let cur = 0;
    switch (md.t) {
      case 'build': cur = (reg.b[md.b] || {}).n || 0; break;
      case 'level': cur = (reg.b[md.b] && reg.b[md.b].n) ? reg.b[md.b].lvl : 0; break;
      case 'prod': cur = reg.stats.prod[md.r] || 0; break;
      case 'cycles': cur = reg.stats.cycles[md.b] || 0; break;
      case 'pay': { const pr = E.projectProgress(S, 'm:' + id, md.cost); cur = pr.need ? pr.have / pr.need : 1; break; }
      case 'energy': cur = reg.en.gen || E.regionEnergy(S, rid, m).gen; break;
      case 'route': cur = run.routes.filter((r) => r.from === rid || r.to === rid).length; break;
      case 'deliver': cur = reg.stats.deliv[md.r] || 0; break;
      case 'ship': cur = reg.stats.trips; break;
      case 'exped': cur = run.counters.exped; break;
      case 'research': cur = Object.values(S.perm.research).reduce((a, b) => a + b, 0); break;
      case 'promote': cur = Math.max(0, ...Object.values(S.perm.specs).map((s) => s.lvl)); break;
      case 'dyson': cur = run.dyson.stage; break;
      case 'core': cur = run.core ? 1 : 0; break;
      case 'total': cur = Object.keys(reg.b).filter((b) => !D.buildings[b].passive || b !== 'armazem' || true).reduce((a, b) => a + reg.b[b].n, 0); break;
      case 'data': cur = reg.stats.data; break;
      case 'tprod': cur = run.totals.prod[md.r] || 0; break;
      case 'tenergy': cur = RO.reduce((a, r) => a + (run.regions[r].unlocked ? run.regions[r].en.gen : 0), 0); break;
      case 'hasSpec': cur = S.perm.specs[md.s] ? 1 : 0; break;
    }
    return { cur, max, done: cur >= max - EPS };
  };
  E.phaseMissions = function (S, rid) {
    const reg = S.run.regions[rid]; const ph = D.regions[rid].phases[reg.phase]; if (!ph) return [];
    return ph.missions.map((md, i) => ({ md, i, id: E.mid(rid, reg.phase, i), claimed: !!S.run.missions[E.mid(rid, reg.phase, i)] }));
  };
  E.activeMissions = (S, rid) => E.phaseMissions(S, rid).filter((x) => !x.claimed).slice(0, 3);
  // ================= PRÉVIA DE RECOMPENSAS =================
  // Sem efeitos colaterais: não gasta, não sorteia, não marca nada. Usa o mesmo arredondamento de E.grant.
  E.rewardPreview = function (S, rid, rw, m) {
    m = m || E.mods(S);
    const o = { data: 0, frags: 0, cards: {}, res: {}, pend: {}, spec: null, specCard: null, disc: null, discKnown: null, unlock: (rw && rw.unlock) || null };
    if (!rw) return o;
    if (rw.data) o.data = Math.round(rw.data * m.dataGain);
    if (rw.frags) o.frags = rw.frags;
    if (rw.res && rid) {
      const reg = S.run.regions[rid];
      for (const r in rw.res) {
        const fit = Math.max(0, Math.min(rw.res[r], E.localCap(S, rid, r, m) - (reg.st[r] || 0)));
        o.res[r] = fit; if (rw.res[r] - fit > EPS) o.pend[r] = rw.res[r] - fit;
      }
    }
    if (rw.spec) { if (S.perm.specs[rw.spec]) o.specCard = rw.spec; else o.spec = rw.spec; }
    if (rw.cards) for (const s in rw.cards) if (!rw.cardsOwned || S.perm.specs[s]) o.cards[s] = rw.cards[s];
    if (rw.disc && D.discoveries[rw.disc]) { if (E.knows(S, rw.disc)) o.discKnown = rw.disc; else o.disc = rw.disc; }
    return o;
  };
  E.grant = function (S, rid, rw, src) {
    const out = { data: 0, cards: {}, res: {}, pend: {}, frags: 0 };
    if (!rw) return out;
    const m = E.mods(S);
    if (rw.data) { const g = Math.round(rw.data * m.dataGain); S.perm.data += g; out.data = g; }
    if (rw.frags) { S.perm.frags += rw.frags; S.perm.fragsTotal += rw.frags; out.frags = rw.frags; }
    if (rw.res && rid) { // o que não cabe fica aguardando espaço na região (não se perde)
      const reg = S.run.regions[rid]; if (!reg.pend) reg.pend = {};
      for (const r in rw.res) {
        const add = Math.max(0, Math.min(rw.res[r], E.localCap(S, rid, r, m) - (reg.st[r] || 0)));
        reg.st[r] = (reg.st[r] || 0) + add; out.res[r] = add;
        const rest = rw.res[r] - add; if (rest > EPS) { reg.pend[r] = (reg.pend[r] || 0) + rest; out.pend[r] = rest; }
      }
    }
    if (rw.spec) { // já recrutado: vira uma carta (informada em out.cards)
      if (S.perm.specs[rw.spec]) { E.recruit(S, rw.spec); out.cards[rw.spec] = (out.cards[rw.spec] || 0) + 1; }
      else { E.recruit(S, rw.spec); out.spec = rw.spec; }
    }
    if (rw.cards) for (const s in rw.cards) { if (rw.cardsOwned && !S.perm.specs[s]) continue; E.addCards(S, s, rw.cards[s]); out.cards[s] = (out.cards[s] || 0) + rw.cards[s]; }
    if (rw.unlock) { S.run.flags[rw.unlock] = true; out.unlock = rw.unlock; }
    if (rw.disc && D.discoveries[rw.disc]) { // permanente: só a primeira vez é novidade
      if (!E.knows(S, rw.disc)) { S.perm.disc[rw.disc] = 1; out.disc = rw.disc; E.log(S, 'gold', 'Descoberta: ' + D.discoveries[rw.disc].name + '. Novas pesquisas disponíveis.'); }
      else out.discKnown = rw.disc;
    }
    return out;
  };
  E.claim = function (S, rid, id) {
    const run = S.run; if (run.missions[id]) return { ok: false, err: 'Já resgatada' };
    const x = E.activeMissions(S, rid).find((a) => a.id === id); if (!x) return { ok: false, err: 'Missão inativa' };
    if (!E.mProg(S, rid, x.md, id).done) return { ok: false, err: 'Incompleta' };
    run.missions[id] = 1;
    const got = E.grant(S, rid, x.md.rw, 'mission');
    if (x.md.rw && x.md.rw.unlock === 'expeditions') E.log(S, 'story', 'A Doca Orbital está pronta. Sondas podem partir em expedições.');
    if (E.phaseMissions(S, rid).every((a) => a.claimed)) E.completePhase(S, rid);
    return { ok: true, got };
  };
  E.completePhase = function (S, rid) {
    const run = S.run; const reg = run.regions[rid]; const def = D.regions[rid];
    const ph = def.phases[reg.phase];
    const gpi = run.gpi++;
    E.makeChest(S, rid, gpi, 'Baú de Suprimentos — ' + ph.name);
    reg.phase++;
    E.log(S, 'gold', def.name + ': fase “' + ph.name + '” concluída! Baú de Suprimentos recebido.');
    const next = def.phases[reg.phase];
    if (next) E.log(S, 'story', next.name + ' — ' + next.story);
    else {
      const nr = E.nextRegion(rid);
      if (nr) E.log(S, 'story', def.name + ' está consolidada. Prepare a expedição planetária a ' + D.regions[nr].name + '.');
      else E.log(S, 'purple', 'A anomalia foi decifrada: é o projeto de uma singularidade artificial.');
    }
    E.emit(S, 'phase', ph.name, { rid });
  };

  // ================= ESPECIALISTAS =================
  E.recruit = function (S, sid) {
    const p = S.perm;
    if (!p.specs[sid]) {
      p.specs[sid] = { lvl: 1, cards: 0 };
      const sp = D.specs[sid];
      E.log(S, 'gold', sp.name + ', ' + sp.role + ', entrou para a tripulação! ' + sp.desc);
      E.emit(S, 'recruit', sp.name, { sid });
      if (D.cats[sp.cat]) p.ach.auto1 = p.ach.auto1 || Date.now();
    } else p.specs[sid].cards += 1;
  };
  E.addCards = function (S, sid, n) {
    const s = S.perm.specs[sid];
    if (!s) { if (n > 0) { E.recruit(S, sid); if (n > 1) S.perm.specs[sid].cards += n - 1; } return; }
    s.cards += n;
  };
  E.promoteCost = function (S, sid) { const lvl = S.perm.specs[sid].lvl; return { cards: D.specCards[lvl], data: D.specData[lvl] }; };
  E.canPromote = function (S, sid) {
    const s = S.perm.specs[sid]; if (!s || s.lvl >= D.specMaxLevel) return false;
    const c = E.promoteCost(S, sid); return s.cards >= c.cards && S.perm.data + EPS >= c.data;
  };
  E.promote = function (S, sid) {
    if (!E.canPromote(S, sid)) return { ok: false, err: 'Requisitos não atendidos' };
    const s = S.perm.specs[sid]; const c = E.promoteCost(S, sid);
    s.cards -= c.cards; S.perm.data -= c.data; s.lvl++;
    E.log(S, 'gold', D.specs[sid].name + ' promovido(a) ao nível ' + s.lvl + '!');
    return { ok: true };
  };
  E.specLabel = function (sid, lvl) {
    const sp = D.specs[sid];
    if (sid === 'oraculo') return 'Ciência ' + F.x(D.science.oracleSpeed[lvl]) + ' · Laboratório ' + F.x(D.specSpeed[lvl]);
    if (D.cats[sp.cat]) return 'Velocidade ' + F.x(D.specSpeed[lvl]);
    if (sid === 'vega') return 'Viagens ' + F.x(1 + 0.5 * lvl);
    if (sid === 'lumen') return 'Energia ' + F.x(1 + 0.2 * lvl);
    if (sid === 'eco') return 'Velocidade global ' + F.x(1 + 0.15 * lvl);
    if (sid === 'reliquia') return 'Expedições ' + F.x(1 + 0.25 * lvl);
    return '';
  };
  E.specExtra = function (sid, lvl) {
    if (sid === 'helio') return 'Geração solar ' + F.x(1 + 0.25 * lvl);
    if (sid === 'oraculo') return 'Dados de pesquisa ' + F.x(1 + 0.1 * lvl);
    return '';
  };

  // ================= BAÚS =================
  E.makeChest = function (S, rid, gpi, title) {
    const c = D.chest(gpi); const rng = E.rng(S);
    // só especialistas que ainda precisam de cartas para evoluir (mesmos pesos regionais e de raridade)
    const owned = Object.keys(S.perm.specs).filter((s) => E.cardsNeeded(S, s) > 0);
    const rel = (D.regions[rid] && D.regions[rid].specs) || [];
    const w = owned.map((s) => D.specs[s].special ? 0.3 : rel.includes(s) ? 3 : 1);
    const tot = w.reduce((a, b) => a + b, 0);
    const cards = {}; let data = c.data; let sup = 0;
    for (let i = 0; i < c.cards; i++) {
      if (!owned.length) { if (Object.keys(S.perm.specs).length) sup++; else data += 10; continue; }
      let x = rng() * tot, k = 0; while (x > w[k] && k < w.length - 1) { x -= w[k]; k++; }
      cards[owned[k]] = (cards[owned[k]] || 0) + 1;
    }
    const ch = { id: S.perm.seq++, title, rid, data, cards }; if (sup) ch.sup = sup;
    S.perm.chests.push(ch);
  };
  // cartas que ainda faltam para levar o especialista ao nível máximo (descontando as que já tem)
  E.cardsNeeded = function (S, sid) {
    const s = S.perm.specs[sid]; if (!s) return 0; let need = 0;
    for (let l = s.lvl; l < D.specMaxLevel; l++) need += D.specCards[l];
    return Math.max(0, need - s.cards);
  };
  // suprimentos de um baú sem cartas úteis: materiais para a região do baú (ou a Lua), sem dados nem fragmentos
  E.chestSupply = (n) => ({ metal: 40 * n, alloy: 12 * n, comp: 3 * n });
  E.openChest = function (S, id) {
    const i = S.perm.chests.findIndex((c) => c.id === id); if (i < 0) return { ok: false };
    const ch = S.perm.chests.splice(i, 1)[0];
    const m = E.mods(S); const data = Math.round(ch.data * m.dataGain);
    S.perm.data += data;
    for (const s in ch.cards) E.addCards(S, s, ch.cards[s]);
    let sup = null;
    if (ch.sup) { const rid = ch.rid && S.run.regions[ch.rid] && S.run.regions[ch.rid].unlocked ? ch.rid : 'lua'; const got = E.grant(S, rid, { res: E.chestSupply(ch.sup) }, 'chest'); sup = { rid, res: got.res, pend: got.pend }; }
    S.perm.ach.chest1 = S.perm.ach.chest1 || Date.now();
    return { ok: true, chest: ch, data, sup };
  };

  // ================= EXPEDIÇÕES =================
  E.expAvail = function (S, id) {
    const def = D.expeditions[id]; const run = S.run;
    if (!run.flags.expeditions) return { ok: false, why: 'Requer a Doca Orbital (Lua, fase Base Orbital)' };
    if (def.universe && run.universe !== def.universe) return { ok: false, hidden: true, why: 'Só existe no ' + D.universes[def.universe].name };
    if (!run.regions[def.region].unlocked) return { ok: false, why: 'Requer ' + D.regions[def.region].name };
    if (def.spec && !S.perm.specs[def.spec]) return { ok: false, why: 'Requer ' + D.specs[def.spec].name + ' na tripulação' };
    if (def.recruit && S.perm.specs[def.recruit] && !def.spec) { /* repetível: dá cartas */ }
    if (run.exps.some((e) => e.id === id)) return { ok: false, why: 'Sonda já em campo' };
    return { ok: true };
  };
  E.expSlots = (S, m) => Math.floor((m || E.mods(S)).expSlots);
  E.expDur = (S, id, m) => D.expeditions[id].dur * (m || E.mods(S)).expTime;
  E.startExp = function (S, id) {
    const a = E.expAvail(S, id); if (!a.ok) return { ok: false, err: a.why };
    const m = E.mods(S); if (S.run.exps.length >= E.expSlots(S, m)) return { ok: false, err: 'Todas as sondas estão em campo' };
    const def = D.expeditions[id]; const reg = S.run.regions[def.region];
    if (!E.afford(reg, def.cost)) return { ok: false, err: 'Recursos insuficientes em ' + D.regions[def.region].name };
    E.pay(reg, def.cost);
    const rng = E.rng(S); const bonus = [];
    for (const [p, rw] of def.bonus) if (rng() < p) bonus.push(rw);
    S.run.exps.push({ id, uid: ++S.run.expSeq, end: S.run.time + E.expDur(S, id, m), dur: E.expDur(S, id, m), bonus });
    return { ok: true };
  };
  function scaleRw(rw, mult) {
    const o = {};
    if (rw.data) o.data = Math.round(rw.data * mult);
    if (rw.frags) o.frags = rw.frags;
    if (rw.cards) { o.cards = {}; for (const s in rw.cards) o.cards[s] = Math.max(1, Math.round(rw.cards[s] * mult)); }
    return o;
  }
  E.expReward = function (S, e, guaranteedOnly) {
    const def = D.expeditions[e.id]; const m = E.mods(S);
    const parts = [scaleRw(def.g, m.expReward)];
    if (!guaranteedOnly) for (const b of e.bonus) parts.push(scaleRw(b, m.expReward));
    return parts;
  };
  // marca, no universo atual, que a expedição já deu seu fragmento (fica em run.flags: reinicia no Colapso)
  E.expFragKey = (id) => 'frag:' + id;
  E.expFragDone = (S, id) => !!S.run.flags[E.expFragKey(id)];
  // prévia sem sorteio: o garantido e cada bônus possível com sua chance, já com expReward e dataGain
  // (mesma ordem de arredondamento do resgate) e o limite de fragmento restante no universo
  E.expPreview = function (S, id, m) {
    m = m || E.mods(S); const def = D.expeditions[id]; const fdone = E.expFragDone(S, id);
    const eff = (rw) => {
      const s = scaleRw(rw, m.expReward); const cards = Object.assign({}, s.cards || {}); let recruit = null;
      if (def.recruit && cards[def.recruit] && !S.perm.specs[def.recruit]) { recruit = def.recruit; cards[def.recruit]--; if (!cards[def.recruit]) delete cards[def.recruit]; }
      return { data: s.data ? Math.round(s.data * m.dataGain) : 0, cards, recruit, frags: s.frags && !fdone ? 1 : 0, fragBlocked: !!(s.frags && fdone) };
    };
    return { g: eff(def.g), bonus: def.bonus.map(([p, rw]) => Object.assign({ p }, eff(rw))), fragDone: fdone };
  };
  E.collectExp = function (S, uid, force, guaranteedOnly) {
    const i = S.run.exps.findIndex((e) => e.uid === uid); if (i < 0) return { ok: false };
    const e = S.run.exps[i]; if (!force && S.run.time + EPS < e.end) return { ok: false, err: 'Em andamento' };
    S.run.exps.splice(i, 1);
    const def = D.expeditions[e.id]; const total = { data: 0, cards: {}, frags: 0 };
    const fk = E.expFragKey(e.id);
    for (const rw of E.expReward(S, e, guaranteedOnly)) {
      // fragmento de descoberta: no máximo 1 por expedição em cada universo (repetições dão só cartas e dados)
      if (rw.frags) { if (S.run.flags[fk]) { total.fragsDone = (total.fragsDone || 0) + rw.frags; delete rw.frags; } else { rw.frags = 1; S.run.flags[fk] = true; } }
      if (def.recruit && rw.cards && rw.cards[def.recruit] && !S.perm.specs[def.recruit]) { E.recruit(S, def.recruit); rw.cards[def.recruit]--; total.recruit = def.recruit; }
      const got = E.grant(S, null, rw, 'exp');
      total.data += got.data; total.frags += got.frags;
      for (const s in got.cards) total.cards[s] = (total.cards[s] || 0) + got.cards[s];
    }
    S.run.counters.exped++; S.perm.ach.exp1 = S.perm.ach.exp1 || Date.now();
    return { ok: true, total, name: def.name };
  };

  // ================= ROTAS =================
  E.createRoute = function (S, from, to, res) {
    const run = S.run; if (from === to) return { ok: false, err: 'Origem e destino iguais' };
    if (!run.regions[from].unlocked || !run.regions[to].unlocked) return { ok: false, err: 'Região bloqueada' };
    const cost = E.routeCost(S, null, from); const reg = run.regions[from];
    if (!E.afford(reg, cost)) return { ok: false, err: 'Recursos insuficientes na origem' };
    E.pay(reg, cost); run.routesBuilt++;
    const rt = { id: ++run.routeSeq, from, to, res: res && res.length ? res.slice(0, 3) : ['metal'], reserve: 0, lvl: 1, auto: true, st: 'idle', t: 0, T: 0, cargo: {}, trips: 0, why: '' };
    run.routes.push(rt); S.perm.ach.route1 = S.perm.ach.route1 || Date.now();
    return { ok: true, rt };
  };
  E.sendRoute = function (S, id) {
    const rt = S.run.routes.find((r) => r.id === id); if (!rt || rt.st !== 'idle') return { ok: false, err: 'Cargueiro em viagem' };
    const ok = routeDepart(S, rt, E.mods(S)); return ok ? { ok: true } : { ok: false, err: E.routeWhyText(rt.why) };
  };
  E.upgradeRoute = function (S, id) {
    const rt = S.run.routes.find((r) => r.id === id); if (!rt) return { ok: false };
    if (rt.lvl >= D.route.maxLvl) return { ok: false, err: 'Nível máximo' };
    const cost = E.routeUpCost(S, rt); const reg = S.run.regions[rt.from];
    if (!E.afford(reg, cost)) return { ok: false, err: 'Recursos insuficientes na origem' };
    E.pay(reg, cost); rt.lvl++; return { ok: true };
  };
  // Ao desmontar, a carga a bordo vai para o destino até o limite; o restante volta à origem até o
  // limite. O que não couber em nenhum dos dois é informado antes da confirmação (E.removePreview).
  E.removePreview = function (S, id) {
    const run = S.run; const rt = run.routes.find((r) => r.id === id); if (!rt) return null;
    const m = E.mods(S); const out = { toDest: {}, toOrigin: {}, lost: {}, any: false };
    const onboard = rt.st === 'out' || rt.st === 'wait';
    for (const r in (onboard ? rt.cargo : {})) {
      const amt = rt.cargo[r]; if (!(amt > 0)) continue; out.any = true;
      const sd = Math.max(0, E.cap(S, rt.to, r, m) - (run.regions[rt.to].st[r] || 0) - E.inbound(S, rt.to, r, rt));
      const d = Math.min(amt, sd);
      const so = Math.max(0, E.cap(S, rt.from, r, m) - (run.regions[rt.from].st[r] || 0));
      const o = Math.min(amt - d, so);
      if (d > 0) out.toDest[r] = d; if (o > 0) out.toOrigin[r] = o;
      if (amt - d - o > EPS) out.lost[r] = amt - d - o;
    }
    return out;
  };
  E.removeRoute = function (S, id) {
    const run = S.run; const i = run.routes.findIndex((r) => r.id === id); if (i < 0) return { ok: false, err: 'Rota não encontrada' };
    const rt = run.routes[i]; const pv = E.removePreview(S, id);
    const to = run.regions[rt.to], from = run.regions[rt.from];
    for (const r in pv.toDest) { to.st[r] = (to.st[r] || 0) + pv.toDest[r]; to.stats.deliv[r] = (to.stats.deliv[r] || 0) + pv.toDest[r]; }
    for (const r in pv.toOrigin) from.st[r] = (from.st[r] || 0) + pv.toOrigin[r];
    rt.cargo = {};
    run.routes.splice(i, 1); return { ok: true, pv };
  };

  // ================= PESQUISA =================
  E.resLate = (id, lvl) => { const n = D.research[id]; if (n.cur === 'frag' || n.opt || D.researchLate.basic.includes(id)) return false; return lvl >= (n.max >= 5 ? n.max - 2 : n.max - 1); };
  E.resCost = (id, lvl) => Math.ceil(D.research[id].cost * Math.pow(D.research[id].cg, lvl) * (E.resLate(id, lvl) ? D.researchLate.mult : 1));
  E.knows = (S, did) => !!(S.perm.disc && S.perm.disc[did]);
  // descoberta exigida para comprar o próximo nível (null se não houver)
  E.resDiscNeed = (S, id) => { const g = D.research[id].disc; const lvl = S.perm.research[id] || 0; return g && lvl + 1 >= g.from && !E.knows(S, g.d) ? g.d : null; };
  E.resState = function (S, id) {
    const node = D.research[id]; const lvl = S.perm.research[id] || 0;
    if (lvl >= node.max) return { lvl, max: true };
    const reqMiss = (node.req || []).filter((r) => !(S.perm.research[r] > 0)); const disc = E.resDiscNeed(S, id);
    const locked = reqMiss.length > 0 || !!disc;
    const why = reqMiss.length ? 'Requer ' + reqMiss.map((r) => D.research[r].name).join(', ') : disc ? 'Requer a descoberta “' + D.discoveries[disc].name + '” (' + E.discSource(disc) + ')' : '';
    const cost = E.resCost(id, lvl); const cur = node.cur === 'frag' ? 'frag' : 'data';
    const have = cur === 'frag' ? S.perm.frags : S.perm.data;
    return { lvl, locked, why, disc, cost, cur, can: !locked && have + EPS >= cost };
  };
  E.discSource = (did) => { const [rid, p, i] = D.discoveries[did].from.split('.'); return D.regions[rid].name + ': ' + E.mTitle(D.regions[rid].phases[+p].missions[+i]); };
  E.buyResearch = function (S, id) {
    const st = E.resState(S, id); if (st.max || !st.can) return { ok: false, err: st.max ? 'Pesquisa completa' : st.locked ? st.why : 'Recursos insuficientes' };
    if (st.cur === 'frag') S.perm.frags -= st.cost; else S.perm.data -= st.cost;
    S.perm.research[id] = st.lvl + 1;
    return { ok: true };
  };

  // ================= COLAPSO =================
  E.collapseReqs = function (S) {
    const run = S.run;
    return [
      { label: 'Investigar a anomalia de Netuno', ok: E.regionDone(S, 'netuno'), cur: run.regions.netuno.phase, max: D.regions.netuno.phases.length },
      { label: 'Enxame de Dyson (' + D.dysonRequired + ' etapas)', ok: run.dyson.stage >= D.dysonRequired, cur: run.dyson.stage, max: D.dysonRequired },
      { label: 'Núcleo da Singularidade construído', ok: run.core, cur: run.core ? 1 : 0, max: 1 },
    ];
  };
  E.canCollapse = (S) => E.collapseReqs(S).every((r) => r.ok);
  E.fragCalc = function (S, extraValue) {
    const run = S.run; const C = D.collapse; const m = E.mods(S);
    const value = run.totals.value + (extraValue || 0);
    const prod = Math.floor(C.prodK * Math.pow(value / C.prodRef, C.prodExp));
    const regions = RO.filter((r) => E.regionDone(S, r)).length * C.perRegion;
    const req = Math.min(run.dyson.stage, D.dysonRequired), extra = Math.max(0, run.dyson.stage - D.dysonRequired);
    const stages = req * C.perStage + extra * C.perExtraStage;
    const core = run.core ? C.core : 0;
    const base = prod + regions + stages + core;
    const total = Math.floor(base * m.fragGain);
    return { value, prod, regions, stages, core, base, mult: m.fragGain, total };
  };
  E.valueRate = (S) => { let v = 0; for (const rid of RO) { const reg = S.run.regions[rid]; if (!reg.unlocked) continue; for (const r in reg.rate) if (reg.rate[r] > 0 && D.res[r]) v += reg.rate[r] * D.res[r].v; } return v; };
  E.collapseOffer = function (S) {
    const run = S.run; const m = E.mods(S); const n = Math.min(m.offers, D.universeOrder.length - 1);
    if (run.offer && run.offer.length === n) return run.offer;
    const pool = D.universeOrder.filter((u) => u !== run.universe);
    const rng = E.rng(S);
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    run.offer = pool.slice(0, n); return run.offer;
  };
  // pendências tratadas explicitamente antes do reinício
  E.collapsePending = function (S) {
    const run = S.run; const out = { missions: [], expsDone: [], expsRunning: [], dirs: E.dirs(S).filter((d) => !d.claimed && d.p.done) };
    for (const rid of RO) {
      if (!run.regions[rid].unlocked) continue;
      for (const x of E.activeMissions(S, rid)) if (E.mProg(S, rid, x.md, x.id).done) out.missions.push({ rid, x });
    }
    for (const e of run.exps) (run.time >= e.end ? out.expsDone : out.expsRunning).push(e);
    return out;
  };
  E.doCollapse = function (S, uni) {
    if (!E.canCollapse(S)) return { ok: false, err: 'Requisitos não atendidos' };
    const offer = E.collapseOffer(S); if (!offer.includes(uni)) return { ok: false, err: 'Destino inválido' };
    const run = S.run; const perm = S.perm;
    const sum = { missions: 0, data: 0, cards: {}, exps: 0 };
    // 1) missões concluídas e não resgatadas: credita a parte permanente
    // A lista de pendências é fixada antes de liquidar qualquer coisa (é a que a prévia mostrou): um prêmio
    // liquidado aqui não cria nova pendência. Ordem: missões → diretrizes → expedições.
    const pend = E.collapsePending(S);
    sum.dirs = 0; sum.frags = 0; sum.disc = [];
    for (const { rid, x } of pend.missions) {
      run.missions[x.id] = 1; const rw = x.md.rw || {};
      // parte permanente: dados, recrutamento/cartas, fragmentos e descobertas (materiais são locais e reiniciam)
      const got = E.grant(S, null, { data: rw.data, spec: rw.spec, cards: rw.cards, cardsOwned: rw.cardsOwned, frags: rw.frags, disc: rw.disc }, 'collapse');
      sum.missions++; sum.data += got.data; sum.frags += got.frags; if (got.disc) sum.disc.push(got.disc);
      for (const s in got.cards) sum.cards[s] = (sum.cards[s] || 0) + got.cards[s];
    }
    for (const d of pend.dirs) {
      const r = E.claimDir(S, d.i); if (!r.ok) continue;
      sum.dirs++; sum.data += r.got.data; sum.frags += r.got.frags;
    }
    // 2) expedições: concluídas = recompensa completa; em andamento = recompensa garantida
    for (const e of pend.expsDone.slice()) { const r = E.collectExp(S, e.uid, true, false); sum.exps++; sum.data += r.total.data; for (const s in r.total.cards) sum.cards[s] = (sum.cards[s] || 0) + r.total.cards[s]; }
    for (const e of pend.expsRunning.slice()) { const r = E.collectExp(S, e.uid, true, true); sum.exps++; sum.data += r.total.data; for (const s in r.total.cards) sum.cards[s] = (sum.cards[s] || 0) + r.total.cards[s]; }
    // 3) fragmentos
    const fc = E.fragCalc(S);
    perm.frags += fc.total; perm.fragsTotal += fc.total; perm.collapses++;
    perm.universes.push({ u: run.universe, frags: fc.total, dyson: run.dyson.stage, time: Math.round(run.time), value: run.totals.value, at: Date.now() });
    perm.visited[uni] = true;
    // cargas em trânsito são materiais locais: reiniciam junto com estoques e rotas (não são creditadas)
    sum.cargo = run.routes.reduce((a, rt) => a + (rt.st === 'out' || rt.st === 'wait' ? E.cargoTotal(rt) : 0), 0);
    sum.pend = RO.reduce((a, r) => a + E.pendingTotal(run.regions[r]), 0); // suprimentos aguardando espaço: locais
    const first = perm.collapses === 1;
    // 4) novo universo
    S.run = E.newRun(S, uni);
    if (first && !perm.specs.eco) E.recruit(S, 'eco');
    E.log(S, 'purple', 'Colapso concluído. A sonda emerge no ' + D.universes[uni].name + '. ' + D.universes[uni].desc);
    E.checkAch(S);
    return { ok: true, frags: fc.total, sum };
  };

  // diretrizes do universo (missões opcionais)
  E.dirs = (S) => (D.universes[S.run.universe].dirs || []).map((md, i) => ({ md, i, claimed: !!S.run.dirs[i], p: E.mProg(S, null, md, 'dir' + i) }));
  E.claimDir = function (S, i) {
    const d = E.dirs(S)[i]; if (!d || d.claimed || !d.p.done) return { ok: false };
    S.run.dirs[i] = 1; const got = E.grant(S, null, d.md.rw, 'dir'); return { ok: true, got };
  };

  // ================= CONQUISTAS =================
  E.checkAch = function (S) {
    const p = S.perm, run = S.run, a = p.ach, now = Date.now();
    const set = (k) => { if (!a[k]) { a[k] = now; const d = D.achievements.find((x) => x.id === k); if (d) E.emit(S, 'ach', d.name); } };
    const lv = Object.values(p.specs).map((s) => s.lvl);
    if (lv.some((l) => l >= 3)) set('promo3');
    if (lv.some((l) => l >= 5)) set('promo5');
    if (run.regions.marte.unlocked) set('mars');
    if (run.regions.jupiter.unlocked) set('outer');
    if (run.regions.netuno.unlocked) set('edge');
    if (run.dyson.stage >= 1) set('dyson1');
    if (run.dyson.stage >= D.dysonRequired) set('dysonR');
    if (run.dyson.stage >= 10) set('dyson10');
    if (p.collapses >= 1) set('collapse1');
    if (p.collapses >= 3) set('collapse3');
    if (D.universeOrder.every((u) => p.visited[u])) set('alluni');
  };

  // ================= OFFLINE =================
  E.newReport = () => ({ prod: {}, deliv: {}, data: 0, stall: {}, sec: 0 });
  E.simulate = function (S, sec) {
    const rep = E.newReport(); rep.sec = sec;
    const before = new Set(); const m0 = E.mods(S);
    for (const rid of RO) { if (!S.run.regions[rid].unlocked) continue; for (const x of E.activeMissions(S, rid)) if (E.mProg(S, rid, x.md, x.id, m0).done) before.add(x.id); }
    const expBefore = new Set(S.run.exps.filter((e) => S.run.time >= e.end).map((e) => e.uid));
    const step = sec <= 600 ? 0.5 : sec <= 3600 ? 1 : sec / 3600;
    let left = sec;
    while (left > EPS) { const dt = Math.min(step, left); E.tick(S, dt, rep); left -= dt; }
    rep.missions = [];
    for (const rid of RO) { if (!S.run.regions[rid].unlocked) continue; for (const x of E.activeMissions(S, rid)) if (!before.has(x.id) && E.mProg(S, rid, x.md, x.id).done) rep.missions.push(E.mTitle(x.md)); }
    rep.exps = S.run.exps.filter((e) => S.run.time >= e.end && !expBefore.has(e.uid)).map((e) => D.expeditions[e.id].name);
    return rep;
  };
  E.offlineCapSec = (S) => E.mods(S).offlineH * 3600;
  // aplica o tempo ausente uma única vez (lastTick avança antes de devolver)
  E.applyOffline = function (S, nowMs) {
    const last = S.lastTick || nowMs;
    S.lastTick = nowMs;
    if (nowMs <= last) return null;
    const away = (nowMs - last) / 1000; if (away < 30) { if (away > 0) E.simulate(S, away); return null; }
    const used = Math.min(away, E.offlineCapSec(S));
    const rep = E.simulate(S, used); rep.away = away; rep.used = used;
    return rep;
  };

  // ================= SALVAMENTO =================
  // Ordem fixa das chaves: a revisão (rev) pode ser lida sem interpretar o salvamento inteiro (E.peekRev).
  E.serialize = (S) => JSON.stringify({ game: 'helios-idle', v: D.SAVE_VERSION, rev: S.rev || 0, at: Date.now(), lastTick: S.lastTick || Date.now(), profile: S.profile || null, perm: S.perm, run: S.run, settings: S.settings });
  E.peekRev = function (str) {
    if (!str) return -1;
    const mm = /^\{"game":"helios-idle","v":\d+,"rev":(\d+)/.exec(str);
    return mm ? +mm[1] : 0; // salvamentos v1 não têm revisão
  };
  const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  const MIGRATIONS = {
    // v1 → v2: um ciclo manual em andamento passa a registrar as máquinas e o nível pagos.
    // Os insumos já foram cobrados; o ciclo entrega uma única vez com os valores que o salvamento tinha.
    1: (o) => {
      const regs = o.run && isObj(o.run.regions) ? o.run.regions : {};
      for (const rid in regs) {
        const b = isObj(regs[rid]) && isObj(regs[rid].b) ? regs[rid].b : {};
        for (const bid in b) { const bs = b[bid]; if (isObj(bs) && bs.on === true && !bs.mc) bs.mc = { n: bs.n, lvl: bs.lvl }; }
      }
      o.rev = 0; o.v = 2; return o;
    },
    // v2 → v3: descobertas permanentes (perm.disc). Reconhece só o que o salvamento comprova: qualquer Colapso
    // anterior (campanha completa), a missão-marco resgatada ou a fase dela já concluída, ou a pesquisa
    // avançada já comprada. Não entrega dados nem cartas: carregar várias vezes dá o mesmo resultado.
    2: (o) => {
      const P = isObj(o.perm) ? o.perm : null, R = isObj(o.run) ? o.run : null;
      if (P) {
        const disc = isObj(P.disc) ? P.disc : {};
        const all = typeof P.collapses === 'number' && P.collapses >= 1;
        for (const id of D.discOrder) {
          if (disc[id]) continue;
          const src = D.discoveries[id].from; const [rid, ph] = src.split('.');
          const reg = R && isObj(R.regions) && isObj(R.regions[rid]) ? R.regions[rid] : null;
          const claimed = !!(R && isObj(R.missions) && R.missions[src]);
          const pastPhase = !!(reg && typeof reg.phase === 'number' && reg.phase > +ph);
          const owned = isObj(P.research) && Object.keys(D.researchDisc).some((n) => D.researchDisc[n].d === id && (P.research[n] || 0) >= D.researchDisc[n].from);
          if (all || claimed || pastPhase || owned) disc[id] = 1;
        }
        P.disc = disc;
      }
      o.v = 3; return o;
    },
  };
  E.MIGRATIONS = MIGRATIONS;

  // ---- validação: confere tipos, campos, identificadores, enums e números antes de aceitar ----
  function fail(path, msg) { const e = new Error('“' + path + '” ' + msg); e.save = true; throw e; }
  const DEF = Symbol('def');
  function vNum(o, k, path, opt) {
    opt = opt || {}; const p = path + '.' + k; let v = o[k];
    if (v === undefined || v === null) { if (opt.def === undefined) fail(p, 'é obrigatório e está ausente'); v = o[k] = opt.def; }
    if (typeof v !== 'number' || !isFinite(v)) fail(p, 'deveria ser um número');
    if (opt.int && !Number.isInteger(v)) fail(p, 'deveria ser um número inteiro');
    if (opt.min !== undefined && v < opt.min) { if (opt.clamp) v = o[k] = opt.min; else fail(p, 'está abaixo do mínimo (' + opt.min + ')'); }
    if (opt.max !== undefined && v > opt.max) { if (opt.clamp) v = o[k] = opt.max; else fail(p, 'está acima do máximo (' + opt.max + ')'); }
    return v;
  }
  function vBool(o, k, path, def) {
    if (o[k] === undefined || o[k] === null) o[k] = def;
    if (typeof o[k] !== 'boolean') fail(path + '.' + k, 'deveria ser verdadeiro ou falso');
    return o[k];
  }
  function vStr(o, k, path, def, allowed) {
    if (o[k] === undefined || o[k] === null) { if (def === undefined) fail(path + '.' + k, 'é obrigatório e está ausente'); o[k] = def; }
    if (typeof o[k] !== 'string') fail(path + '.' + k, 'deveria ser um texto');
    if (allowed && !allowed.includes(o[k])) fail(path + '.' + k, 'tem um valor desconhecido (“' + String(o[k]).slice(0, 30) + '”)');
    return o[k];
  }
  function vObj(o, k, path, def) {
    if (o[k] === undefined) { if (def === undefined) fail(path + '.' + k, 'é obrigatório e está ausente'); o[k] = def === DEF ? {} : def(); }
    if (!isObj(o[k])) fail(path + '.' + k, 'deveria ser um objeto');
    return o[k];
  }
  function vArr(o, k, path, required) {
    if (o[k] === undefined && !required) o[k] = [];
    if (!Array.isArray(o[k])) fail(path + '.' + k, 'deveria ser uma lista');
    return o[k];
  }
  // mapa de números ≥ 0 (estoques, estatísticas); chaves desconhecidas são descartadas
  function vNumMap(o, k, path, keyOk) {
    const mp = vObj(o, k, path, DEF);
    for (const key of Object.keys(mp)) {
      if (keyOk && !keyOk(key)) { delete mp[key]; continue; }
      vNum(mp, key, path + '.' + k, { def: 0, min: 0, clamp: true });
    }
    return mp;
  }
  const resKey = (r) => !!D.res[r];
  const specKey = (s) => !!D.specs[s];
  function vReward(rw, path) {
    if (!isObj(rw)) fail(path, 'deveria ser um objeto de recompensa');
    if (rw.data !== undefined) vNum(rw, 'data', path, { min: 0, clamp: true });
    if (rw.frags !== undefined) vNum(rw, 'frags', path, { min: 0, clamp: true });
    if (rw.cards !== undefined) vNumMap(rw, 'cards', path, specKey);
  }
  function vRegion(rid, reg, path) {
    if (!isObj(reg)) fail(path, 'deveria ser um objeto de região');
    vBool(reg, 'unlocked', path, false);
    vNum(reg, 'phase', path, { def: 0, int: true, min: 0, max: D.regions[rid].phases.length });
    const b = vObj(reg, 'b', path, DEF);
    for (const bid of Object.keys(b)) {
      const p = path + '.b.' + bid; const bs = b[bid];
      if (!D.buildings[bid]) fail(p, 'é uma instalação desconhecida');
      if (!isObj(bs)) fail(p, 'deveria ser um objeto de instalação');
      vNum(bs, 'n', p, { def: 0, int: true, min: 0 });
      vNum(bs, 'lvl', p, { def: 1, int: true, min: 1, max: D.maxBuildingLevel });
      vNum(bs, 'p', p, { def: 0, min: 0, max: 1, clamp: true });
      vBool(bs, 'on', p, false); vBool(bs, 'pause', p, false); vBool(bs, 'blk', p, false);
      vStr(bs, 'why', p, '');
      if (bs.eff !== undefined) vNum(bs, 'eff', p, { min: 0, max: 1, clamp: true });
      if (bs.on) {
        if (bs.mc === undefined || bs.mc === null) bs.mc = { n: bs.n, lvl: bs.lvl };
        if (!isObj(bs.mc)) fail(p + '.mc', 'deveria ser um objeto');
        vNum(bs.mc, 'n', p + '.mc', { int: true, min: 0 }); vNum(bs.mc, 'lvl', p + '.mc', { int: true, min: 1, max: D.maxBuildingLevel });
        if (bs.mc.left !== undefined && bs.mc.left !== null) vNumMap(bs.mc, 'left', p + '.mc', resKey); else delete bs.mc.left;
      } else delete bs.mc;
    }
    vNumMap(reg, 'st', path, resKey);
    vNumMap(reg, 'pend', path, resKey);
    if (reg.hold !== undefined) { if (!isObj(reg.hold) || typeof reg.hold.bid !== 'string' || !D.buildings[reg.hold.bid]) delete reg.hold; else reg.hold = { bid: reg.hold.bid }; }
    const exp = vObj(reg, 'exp', path, DEF); for (const r of Object.keys(exp)) { if (!resKey(r) || !exp[r]) delete exp[r]; else exp[r] = true; }
    // campos derivados: refeitos se estiverem inválidos
    if (!isObj(reg.rate)) reg.rate = {}; for (const r of Object.keys(reg.rate)) if (typeof reg.rate[r] !== 'number' || !isFinite(reg.rate[r])) delete reg.rate[r];
    if (!isObj(reg.flow)) reg.flow = {}; for (const r of Object.keys(reg.flow)) if (typeof reg.flow[r] !== 'number' || !isFinite(reg.flow[r])) delete reg.flow[r];
    if (!isObj(reg.en) || ['gen', 'use', 'ratio'].some((k) => typeof reg.en[k] !== 'number' || !isFinite(reg.en[k]))) reg.en = { gen: 0, use: 0, ratio: 1 };
    const st = vObj(reg, 'stats', path, DEF); const sp = path + '.stats';
    vNumMap(st, 'prod', sp, resKey); vNumMap(st, 'cycles', sp, (x) => !!D.buildings[x]); vNumMap(st, 'deliv', sp, resKey);
    vNum(st, 'data', sp, { def: 0, min: 0, clamp: true }); vNum(st, 'trips', sp, { def: 0, min: 0, clamp: true });
    if (st.export !== undefined) vNum(st, 'export', sp, { def: 0, min: 0, clamp: true });
  }
  function validateSave(o) {
    const P = vObj(o, 'perm', 'salvamento'); const R = vObj(o, 'run', 'salvamento');
    // Campo aditivo e opcional: partidas anteriores continuam sem perfil até o jogador criá-lo.
    if (o.profile === undefined || o.profile === null) o.profile = null;
    else {
      const result = E.validateProfile(o.profile);
      if (!result.ok) fail('profile', result.err);
      o.profile = result.profile;
    }
    // ---- progresso permanente ----
    const pp = 'perm';
    for (const k of ['data', 'frags', 'fragsTotal']) vNum(P, k, pp, { def: 0, min: 0, clamp: true });
    vNum(P, 'collapses', pp, { def: 0, int: true, min: 0 }); vNum(P, 'seq', pp, { def: 1, int: true, min: 0 });
    const specs = vObj(P, 'specs', pp, DEF);
    for (const id of Object.keys(specs)) {
      if (!D.specs[id]) { delete specs[id]; continue; }
      const p = pp + '.specs.' + id; const s = specs[id];
      if (!isObj(s)) fail(p, 'deveria ser um objeto com nível e cartas');
      vNum(s, 'lvl', p, { int: true, min: 1, max: D.specMaxLevel }); vNum(s, 'cards', p, { def: 0, min: 0, clamp: true });
    }
    const res = vObj(P, 'research', pp, DEF);
    for (const id of Object.keys(res)) {
      if (!D.research[id]) { delete res[id]; continue; }
      vNum(res, id, pp + '.research', { int: true, min: 0, max: D.research[id].max });
    }
    vObj(P, 'ach', pp, DEF);
    const dsc = vObj(P, 'disc', pp, DEF); for (const k of Object.keys(dsc)) { if (!D.discoveries[k] || !dsc[k]) delete dsc[k]; else dsc[k] = 1; }
    const vis = vObj(P, 'visited', pp, () => ({ padrao: true }));
    for (const u of Object.keys(vis)) { if (!D.universes[u] || !vis[u]) delete vis[u]; else vis[u] = true; }
    vArr(P, 'universes', pp).forEach((u, i) => {
      const p = pp + '.universes[' + i + ']'; if (!isObj(u)) fail(p, 'deveria ser um objeto');
      vStr(u, 'u', p, undefined, D.universeOrder);
      for (const k of ['frags', 'dyson', 'time', 'value', 'at']) vNum(u, k, p, { def: 0, min: 0, clamp: true });
    });
    const ids = new Set();
    vArr(P, 'chests', pp).forEach((c, i) => {
      const p = pp + '.chests[' + i + ']'; if (!isObj(c)) fail(p, 'deveria ser um objeto de baú');
      vNum(c, 'id', p, { int: true }); if (ids.has(c.id)) fail(p + '.id', 'está repetido'); ids.add(c.id);
      vStr(c, 'title', p, 'Baú de Suprimentos'); vStr(c, 'rid', p, '');
      vNum(c, 'data', p, { def: 0, min: 0, clamp: true }); vNumMap(c, 'cards', p, specKey);
      if (c.sup !== undefined) vNum(c, 'sup', p, { int: true, min: 0, max: 100, clamp: true });
    });
    const ps = vObj(P, 'stats', pp, DEF); vNum(ps, 'playSec', pp + '.stats', { def: 0, min: 0, clamp: true }); vNum(ps, 'value', pp + '.stats', { def: 0, min: 0, clamp: true });

    // ---- universo atual ----
    const rp = 'run';
    vStr(R, 'universe', rp, undefined, D.universeOrder);
    vNum(R, 'time', rp, { def: 0, min: 0, clamp: true });
    if (R.regions === null || R.regions === undefined) fail(rp + '.regions', 'está ausente ou vazio');
    const regs = vObj(R, 'regions', rp);
    for (const k of Object.keys(regs)) if (!D.regions[k]) delete regs[k];
    for (const rid of RO) { if (regs[rid] === undefined) regs[rid] = E.newRegion(); vRegion(rid, regs[rid], rp + '.regions.' + rid); }
    if (!regs.lua.unlocked) fail(rp + '.regions.lua', 'deveria estar liberada');
    const mis = vObj(R, 'missions', rp, DEF); for (const k of Object.keys(mis)) { if (!mis[k]) delete mis[k]; else mis[k] = 1; }
    const prj = vObj(R, 'projects', rp, DEF);
    for (const key of Object.keys(prj)) {
      const ok = key === 'dyson' || key === 'core' || (key.startsWith('launch:') && D.regions[key.slice(7)]) || (key.startsWith('m:') && (() => {
        const [rid, ph, i] = key.slice(2).split('.'); return D.regions[rid] && D.regions[rid].phases[+ph] && D.regions[rid].phases[+ph].missions[+i];
      })());
      if (!ok) { delete prj[key]; continue; }
      const pv = prj[key]; const p = rp + '.projects.' + key;
      if (!isObj(pv)) fail(p, 'deveria ser um objeto');
      for (const r of Object.keys(pv)) { if (r === '__done') { pv[r] = 1; continue; } if (!resKey(r)) { delete pv[r]; continue; } vNum(pv, r, p, { def: 0, min: 0, clamp: true }); }
    }
    const rids = new Set(); let maxId = 0;
    vArr(R, 'routes', rp, true).forEach((rt, i) => {
      const p = rp + '.routes[' + i + ']'; if (!isObj(rt)) fail(p, 'deveria ser um objeto de rota');
      vNum(rt, 'id', p, { int: true, min: 1 }); if (rids.has(rt.id)) fail(p + '.id', 'está repetido'); rids.add(rt.id); maxId = Math.max(maxId, rt.id);
      vStr(rt, 'from', p, undefined, RO); vStr(rt, 'to', p, undefined, RO);
      if (rt.from === rt.to) fail(p, 'tem origem e destino iguais');
      if (!Array.isArray(rt.res)) fail(p + '.res', 'deveria ser uma lista');
      rt.res = rt.res.filter((r, j) => typeof r === 'string' && resKey(r) && rt.res.indexOf(r) === j).slice(0, 3);
      if (!rt.res.length) fail(p + '.res', 'não tem nenhum recurso válido');
      vNum(rt, 'reserve', p, { def: 0, min: 0, clamp: true });
      vNum(rt, 'lvl', p, { def: 1, int: true, min: 1, max: D.route.maxLvl });
      vBool(rt, 'auto', p, true); vBool(rt, 'win', p, false);
      vStr(rt, 'st', p, 'idle', ['idle', 'out', 'wait', 'back']);
      vNum(rt, 't', p, { def: 0, min: 0, clamp: true }); vNum(rt, 'T', p, { def: 0, min: 0, clamp: true });
      if (rt.t > rt.T) rt.t = rt.T;
      vNumMap(rt, 'cargo', p, resKey);
      vNum(rt, 'trips', p, { def: 0, min: 0, clamp: true }); vStr(rt, 'why', p, ''); if (rt.exported !== undefined) vNum(rt, 'exported', p, { def: 0, min: 0, clamp: true });
    });
    vNum(R, 'routeSeq', rp, { def: maxId, int: true, min: 0 }); if (R.routeSeq < maxId) R.routeSeq = maxId;
    vNum(R, 'routesBuilt', rp, { def: R.routes.length, min: 0, clamp: true });
    const dy = vObj(R, 'dyson', rp, () => ({ stage: 0, auto: true }));
    vNum(dy, 'stage', rp + '.dyson', { def: 0, int: true, min: 0, max: D.dyson.length }); vBool(dy, 'auto', rp + '.dyson', true);
    vBool(R, 'core', rp, false);
    const uids = new Set(); let maxUid = 0;
    vArr(R, 'exps', rp).forEach((e, i) => {
      const p = rp + '.exps[' + i + ']'; if (!isObj(e)) fail(p, 'deveria ser um objeto de expedição');
      vStr(e, 'id', p, undefined, Object.keys(D.expeditions));
      vNum(e, 'uid', p, { int: true, min: 1 }); if (uids.has(e.uid)) fail(p + '.uid', 'está repetido'); uids.add(e.uid); maxUid = Math.max(maxUid, e.uid);
      vNum(e, 'end', p, { min: 0 }); vNum(e, 'dur', p, { min: 0 });
      vArr(e, 'bonus', p).forEach((rw, j) => vReward(rw, p + '.bonus[' + j + ']'));
    });
    vNum(R, 'expSeq', rp, { def: maxUid, int: true, min: 0 }); if (R.expSeq < maxUid) R.expSeq = maxUid;
    const tot = vObj(R, 'totals', rp, () => ({ value: 0, prod: {} })); vNum(tot, 'value', rp + '.totals', { def: 0, min: 0, clamp: true }); vNumMap(tot, 'prod', rp + '.totals', resKey);
    const cnt = vObj(R, 'counters', rp, () => ({ exped: 0, trips: 0 })); vNum(cnt, 'exped', rp + '.counters', { def: 0, min: 0, clamp: true }); vNum(cnt, 'trips', rp + '.counters', { def: 0, min: 0, clamp: true });
    const fl = vObj(R, 'flags', rp, DEF); for (const k of Object.keys(fl)) fl[k] = !!fl[k];
    if (R.offer !== null && R.offer !== undefined) { if (!Array.isArray(R.offer) || R.offer.some((u) => !D.universes[u] || u === R.universe)) R.offer = null; } else R.offer = null;
    const dirs = vObj(R, 'dirs', rp, DEF); for (const k of Object.keys(dirs)) { if (!dirs[k]) delete dirs[k]; else dirs[k] = 1; }
    vNum(R, 'gpi', rp, { def: 0, int: true, min: 0 });
    R.log = Array.isArray(R.log) ? R.log.filter((l) => isObj(l) && typeof l.text === 'string').map((l) => ({ kind: typeof l.kind === 'string' ? l.kind : 'story', text: l.text, t: typeof l.t === 'number' && isFinite(l.t) ? l.t : 0 })).slice(0, 60) : [];
    vNum(R, 'started', rp, { def: Date.now() });

    // ---- ajustes (inválidos voltam ao padrão) ----
    const defs = { sound: true, reduceMotion: false, sci: false, dev: false, skipAnim: false };
    if (!isObj(o.settings)) o.settings = {};
    for (const k in defs) if (typeof o.settings[k] !== 'boolean') o.settings[k] = defs[k];
    for (const k of Object.keys(o.settings)) if (!(k in defs)) delete o.settings[k];
  }
  // Ensaio: executa o motor numa cópia descartável para garantir que o estado é utilizável.
  function trialRun(S) {
    const T = JSON.parse(JSON.stringify({ perm: S.perm, run: S.run, settings: S.settings })); T.events = [];
    const m = E.mods(T);
    for (const rid of RO) {
      if (!T.run.regions[rid].unlocked) continue;
      E.bList(T, rid); E.bottleneck(T, rid);
      for (const x of E.activeMissions(T, rid)) E.mProg(T, rid, x.md, x.id, m);
      for (const b in T.run.regions[rid].b) { E.bCost(T, rid, b, m); E.uCost(T, rid, b, m); }
    }
    for (const rt of T.run.routes) { E.routeInfo(T, rt, m); E.routeUpCost(T, rt, m); }
    E.tick(T, 0.5); E.tick(T, 5);
    E.collapseReqs(T); E.fragCalc(T); E.dirs(T); E.collapsePending(T);
    for (const sid in T.perm.specs) { E.canPromote(T, sid); E.specLabel(sid, T.perm.specs[sid].lvl); }
    for (const id in D.research) E.resState(T, id);
  }
  function deserialize(str) {
    if (typeof str !== 'string') return { ok: false, err: 'O conteúdo do salvamento está vazio.' };
    let o;
    try { o = JSON.parse(str); } catch (e) { return { ok: false, err: 'O texto não é um salvamento válido (JSON corrompido).' }; }
    if (!isObj(o) || o.game !== 'helios-idle') return { ok: false, err: 'Este conteúdo não é um salvamento do HELIOS IDLE.' };
    if (typeof o.v !== 'number' || !Number.isInteger(o.v) || o.v < 1) return { ok: false, err: 'Salvamento sem versão válida. Não é possível carregar.' };
    if (o.v > D.SAVE_VERSION) return { ok: false, err: 'Este salvamento é de uma versão mais nova do jogo (v' + o.v + ').' };
    const from = o.v;
    while (o.v < D.SAVE_VERSION) { const f = MIGRATIONS[o.v]; if (!f) return { ok: false, err: 'Não há migração da versão ' + o.v + '.' }; o = f(o); }
    if (!isObj(o.perm) || !isObj(o.run)) return { ok: false, err: 'Salvamento incompleto: faltam dados de progresso.' };
    if (!D.universes[o.run.universe]) return { ok: false, err: 'Universo desconhecido no salvamento: ' + String(o.run.universe).slice(0, 30) };
    validateSave(o);
    const S = { profile: o.profile, perm: o.perm, run: o.run, settings: o.settings, events: [] };
    S.rev = typeof o.rev === 'number' && Number.isInteger(o.rev) && o.rev >= 0 ? o.rev : 0;
    S.lastTick = typeof o.lastTick === 'number' && isFinite(o.lastTick) ? o.lastTick : typeof o.at === 'number' && isFinite(o.at) ? o.at : Date.now();
    try { trialRun(S); } catch (e) { return { ok: false, err: 'Salvamento incompatível: o jogo não consegue executá-lo (' + (e && e.message || e) + ').' }; }
    return { ok: true, S, from };
  }
  // Nunca lança exceção: devolve { ok, S } ou { ok: false, err } com mensagem compreensível.
  E.deserialize = function (str) {
    try { return deserialize(str); } catch (e) {
      if (e && e.save) return { ok: false, err: 'Salvamento incompatível: ' + e.message + '.' };
      return { ok: false, err: 'Salvamento incompatível com esta versão do jogo (' + (e && e.message || String(e)) + ').' };
    }
  };
  const b64e = (s) => (typeof btoa !== 'undefined' ? btoa(unescape(encodeURIComponent(s))) : Buffer.from(s, 'utf8').toString('base64'));
  const b64d = (s) => (typeof atob !== 'undefined' ? decodeURIComponent(escape(atob(s))) : Buffer.from(s, 'base64').toString('utf8'));
  E.exportStr = (S) => 'HELIOS1:' + b64e(E.serialize(S));
  E.importStr = function (str) {
    str = (str || '').trim();
    if (!str) return { ok: false, err: 'Cole o código de exportação no campo.' };
    if (str[0] === '{') return E.deserialize(str);
    if (!str.startsWith('HELIOS1:')) return { ok: false, err: 'Código não reconhecido. Ele deve começar com “HELIOS1:”.' };
    let json; try { json = b64d(str.slice(8)); } catch (e) { return { ok: false, err: 'O código está incompleto ou foi alterado.' }; }
    return E.deserialize(json);
  };
})(typeof window !== 'undefined' ? (window.H = window.H || {}) : (globalThis.H = globalThis.H || {}));
