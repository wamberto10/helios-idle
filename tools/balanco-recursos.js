/* Balanço de recursos: campanha do bot até o 1º Colapso em cada universo, com o motor instrumentado
   SÓ na memória (os arquivos do jogo não mudam; não lê nem grava saves).
   node tools/balanco-recursos.js [universo...]
   Mede, por recurso: produzido, consumido como insumo, gasto em ações (construções, melhorias, rotas,
   projetos, lançamentos, expedições), ganho em recompensas, exportado (EXP) e o que sobrou; a conta fecha
   com a diferença de estoque e a carga em trânsito. A cada 10 s de jogo registra estoque cheio/vazio por
   região e o motivo de parada de cada instalação. Resultado em artifacts/balanco-recursos.json. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');

function load() {
  const c = { console, Buffer, Date, Math, JSON, setTimeout, clearTimeout, require, module: { exports: {} }, __dirname, process: { env: { BOT_LIB: '1' } } };
  c.globalThis = c; vm.createContext(c);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/data.js'), 'utf8'), c);
  let engine = fs.readFileSync(path.join(ROOT, 'js/engine.js'), 'utf8');
  const rep = (from, to) => { if (!engine.includes(from)) throw new Error('Instrumentação não encontrou: ' + from); engine = engine.replace(from, to); };
  rep('const a = def.in[r] * n; reg.st[r] = Math.max(0, (reg.st[r] || 0) - a);', 'const a = def.in[r] * n; if (H.__aud) H.__aud("use", reg, r, Math.min(a, reg.st[r] || 0)); reg.st[r] = Math.max(0, (reg.st[r] || 0) - a);');
  rep('    if (!(made > 0)) return;\n    const run = S.run;', '    if (!(made > 0)) return;\n    if (H.__aud) H.__aud("prod", reg, r, made);\n    const run = S.run;');
  rep('const g = amt * D.res[r].v * D.exportRate * m.dataGain; if (!(g > 0)) return;', 'const g = amt * D.res[r].v * D.exportRate * m.dataGain; if (H.__aud && amt > 0) H.__aud("exp", reg, r, amt); if (!(g > 0)) return;');
  // produção automática: saldo líquido por recurso; o consumido é o produzido menos o saldo
  rep('      for (const r in net) {\n        const s = reg.st[r] || 0; let ns = s + net[r];', '      if (H.__aud) for (const r in net) { const used = (made[r] || 0) - net[r]; if (used > 0) H.__aud("use", reg, r, used); }\n      for (const r in net) {\n        const s = reg.st[r] || 0; let ns = s + net[r];');
  rep("from.st.fuel = Math.max(0, from.st.fuel - info.fuel);", 'if (H.__aud) H.__aud("routeFuel", from, "fuel", Math.min(info.fuel, from.st.fuel || 0)); from.st.fuel = Math.max(0, from.st.fuel - info.fuel);');
  rep("if (add > 0) { reg.st[r] = (reg.st[r] || 0) + add; reg.pend[r] -= add; addFlow(reg, r, add); }", 'if (add > 0) { if (H.__aud) H.__aud("gain", reg, r, add); reg.st[r] = (reg.st[r] || 0) + add; reg.pend[r] -= add; addFlow(reg, r, add); }');
  // combustível queimado pelos reatores conta como insumo consumido
  rep('const take = Math.min(have, need);', 'const take = Math.min(have, need); if (H.__aud) H.__aud("use", reg, r, take);');
  vm.runInContext(engine, c);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tools/bot.js'), 'utf8'), c);
  return c;
}

function runUniverse(uni, maxH) {
  const c = load(); const { E, DATA: D, F } = c.H; const { botStep } = c.module.exports;
  const RO = D.regionOrder, RES = D.resOrder;
  const z = () => Object.fromEntries(RES.map((r) => [r, 0]));
  const L = { prod: z(), use: z(), spent: z(), gain: z(), exp: z(), routeFuel: z(), project: z() };
  const byReg = Object.fromEntries(RO.map((rid) => [rid, { prod: z(), use: z(), exp: z() }]));
  let S = null; const regOf = new Map();
  const ridOf = (reg) => { let rid = regOf.get(reg); if (!rid) { rid = RO.find((x) => S.run.regions[x] === reg); regOf.set(reg, rid); } return rid; };
  let ledgerOn = true;
  c.H.__aud = (kind, reg, r, a) => { if (!ledgerOn || !(a > 0) || L[kind][r] === undefined) return; L[kind][r] += a; const rid = ridOf(reg); if (rid && byReg[rid][kind]) byReg[rid][kind][r] += a; };
  const pay = E.pay; E.pay = function (reg, cost) { if (ledgerOn) for (const r in cost) if (L.spent[r] !== undefined) L.spent[r] += Math.min(cost[r], reg.st[r] || 0); return pay.apply(this, arguments); };
  const grant = E.grant; E.grant = function (S2, rid, rw) {
    const before = Object.fromEntries(RO.map((x) => [x, Object.assign({}, S2.run.regions[x].st)]));
    const out = grant.apply(this, arguments);
    if (ledgerOn) for (const x of RO) for (const r of RES) { const d = (S2.run.regions[x].st[r] || 0) - (before[x][r] || 0); if (d > 0) L.gain[r] += d; }
    return out;
  };
  // entregas a projetos (lançamentos, Enxame de Dyson, Núcleo) saem do estoque sem passar pelo pagamento comum
  const contribute = E.contribute; E.contribute = function (S2, key) {
    const before = Object.fromEntries(RO.map((x) => [x, Object.assign({}, S2.run.regions[x].st)]));
    const out = contribute.apply(this, arguments);
    if (ledgerOn) for (const x of RO) for (const r of RES) { const d = (before[x][r] || 0) - (S2.run.regions[x].st[r] || 0); if (d > 0) L.project[r] += d; }
    return out;
  };
  // estoque inicial de cada planeta liberado entra como ganho
  const unlock = E.unlockRegion; E.unlockRegion = function (S2) {
    const before = Object.fromEntries(RO.map((x) => [x, Object.assign({}, S2.run.regions[x].st)]));
    const out = unlock.apply(this, arguments);
    if (ledgerOn) for (const x of RO) for (const r of RES) { const d = (S2.run.regions[x].st[r] || 0) - (before[x][r] || 0); if (d > 0) L.gain[r] += d; }
    return out;
  };
  S = E.newState(); S.run.universe = uni; S.lastTick = Date.now();
  const stockAll = () => { const t = z(); for (const rid of RO) for (const r of RES) t[r] += S.run.regions[rid].st[r] || 0; for (const rt of S.run.routes) for (const r in (rt.cargo || {})) if (t[r] !== undefined) t[r] += rt.cargo[r]; return t; };
  const start = stockAll();
  // amostras: estoque cheio/vazio (onde o recurso é produzido ou usado) e motivo de parada das instalações
  const samp = { n: 0, full: {}, empty: {}, why: {}, energy: {} };
  const relevant = (rid, r) => Object.keys(D.regions[rid].build).some((b) => (D.buildings[b].out || {})[r] || (D.buildings[b].in || {})[r]);
  const sample = () => {
    samp.n++;
    for (const rid of RO) { const reg = S.run.regions[rid]; if (!reg.unlocked) continue; const m = E.mods(S);
      for (const r of RES) { if (!relevant(rid, r)) continue; const k = rid + '.' + r, st = reg.st[r] || 0, cap = E.cap(S, rid, r, m);
        samp.full[k] = samp.full[k] || [0, 0]; samp.full[k][1]++; if (st >= cap * 0.99) samp.full[k][0]++;
        samp.empty[k] = samp.empty[k] || [0, 0]; samp.empty[k][1]++; if (st < 1) samp.empty[k][0]++; }
      for (const bid in reg.b) { const bs = reg.b[bid]; if (!bs.n || D.buildings[bid].passive) continue; const k = rid + '.' + bid;
        const w = samp.why[k] = samp.why[k] || { t: 0 }; w.t++; const why = bs.on ? 'operando' : (bs.blk && bs.why) || (bs.why === 'manual' ? 'manual' : 'operando'); w[why] = (w[why] || 0) + 1; }
      const e = samp.energy[rid] = samp.energy[rid] || []; if (samp.n % 30 === 0) e.push([Math.round(S.run.time / 60), Math.round(reg.en.gen), Math.round(reg.en.use)]);
    }
  };
  const marks = {}; let t = 0; const snaps = {}; // balanço acumulado aos 20 e 40 min
  while (S.run.time < maxH * 3600) {
    for (let i = 0; i < 2; i++) E.tick(S, 1);
    botStep(S); t += 2;
    if (t % 10 === 0) sample();
    for (const mm of [20, 40]) if (!snaps[mm] && S.run.time >= mm * 60) snaps[mm] = JSON.parse(JSON.stringify(L));
    for (const rid of RO) if (S.run.regions[rid].unlocked && marks[rid] === undefined) marks[rid] = Math.round(S.run.time);
    if (E.canCollapse(S)) break;
  }
  ledgerOn = false;
  const end = stockAll();
  const res = {};
  for (const r of RES) {
    const P = L.prod[r], U = L.use[r], Sp = L.spent[r], G = L.gain[r], X = L.exp[r];
    const RF = L.routeFuel[r], PJ = L.project[r]; const err = start[r] + P + G - U - Sp - X - RF - PJ - end[r];
    res[r] = { name: D.res[r].name, value: D.res[r].v, start: start[r], produced: P, gained: G, usedAsInput: U, spent: Sp, routeFuel: RF, project: PJ, exported: X, end: end[r], reconcile: err,
      byRegion: Object.fromEntries(RO.filter((rid) => byReg[rid].prod[r] || byReg[rid].use[r] || byReg[rid].exp[r]).map((rid) => [rid, { prod: byReg[rid].prod[r], use: byReg[rid].use[r], exp: byReg[rid].exp[r] }])) };
  }
  const pct = (a) => Object.fromEntries(Object.entries(a).map(([k, [x, n]]) => [k, n ? Math.round(x / n * 100) : 0]));
  const why = Object.fromEntries(Object.entries(samp.why).map(([k, w]) => [k, Object.fromEntries(Object.entries(w).filter(([x]) => x !== 't').map(([x, v]) => [x, Math.round(v / w.t * 100)]))]));
  return { universe: uni, name: D.universes[uni].name, collapseMin: E.canCollapse(S) ? Math.round(S.run.time / 60) : null, regionsAtMin: Object.fromEntries(Object.entries(marks).map(([k, v]) => [k, Math.round(v / 60)])),
    resources: res, snapshots: snaps, fullPct: pct(samp.full), emptyPct: pct(samp.empty), why, energy: samp.energy, data: { totalValue: S.run.totals.value } };
}

const unis = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const c0 = load(); const all = unis.length ? unis : Object.keys(c0.H.DATA.universes);
const out = { generated: new Date().toISOString(), universes: [] };
for (const u of all) { const t0 = Date.now(); const r = runUniverse(u, 6); out.universes.push(r); console.log(u + ': Colapso ' + r.collapseMin + ' min (' + ((Date.now() - t0) / 1000).toFixed(1) + ' s reais)'); }
fs.mkdirSync(path.join(ROOT, 'artifacts'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'artifacts', 'balanco-recursos.json'), JSON.stringify(out, (k, v) => typeof v === 'number' ? Math.round(v * 100) / 100 : v, 1));
console.log('Resultado em artifacts/balanco-recursos.json');
