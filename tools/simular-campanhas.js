/* Auditoria de balanceamento: campanhas aceleradas, sem alterar dados ou salvamentos.
   node tools/simular-campanhas.js [--quick]
   Carrega o bot original em memória e mede fontes/gastos de dados; artefatos em artifacts/. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const quick = process.argv.includes('--quick');
const round = x => typeof x === 'number' ? Math.round(x * 1000) / 1000 : x;
function load() {
  const c = { console, Buffer, Date, Math, JSON, setTimeout, clearTimeout, require, module: { exports: {} }, __dirname: __dirname, process: { env: { BOT_LIB: '1' } } }; c.globalThis = c;
  vm.createContext(c);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/data.js'), 'utf8'), c);
  let engine = fs.readFileSync(path.join(ROOT, 'js/engine.js'), 'utf8');
  const replace = (from, to) => { if (!engine.includes(from)) throw new Error('Instrumentação não encontrou: ' + from); engine = engine.replace(from, to); };
  replace('function creditData(S, reg, g, rep) {', 'function creditData(S, reg, g, rep, auditBid) { if (H.__auditData && g > 0) H.__auditData(S, reg, g, auditBid);');
  replace('creditData(S, reg, amt, rep);', 'creditData(S, reg, amt, rep, bid);');
  replace('creditData(S, reg, amt * m.dataGain, rep);', 'creditData(S, reg, amt * m.dataGain, rep, a.bid);');
  vm.runInContext(engine, c);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tools/bot.js'), 'utf8') + '\nmodule.exports.auditHelpers={tryBuild,tryUpgrade,ensurePower,ensureSupply,buyResearch,botPaused};', c);
  return c;
}
function researchInfo(D, E) {
  const entries = Object.entries(D.research).filter(([, n]) => n.cur !== 'frag' && !n.opt); // projetos opcionais (opt) ficam fora da árvore
  return { levels: entries.reduce((a, [, n]) => a + n.max, 0), nodes: entries.length, cost: entries.reduce((a, [id, n]) => a + Array.from({ length: n.max }, (_, i) => E.resCost(id, i)).reduce((s, x) => s + x, 0), 0), ids: entries.map(([id]) => id) };
}
function instrument(c) {
  const { E, DATA: D } = c.H; let ledger = null;
  const add = (group, key, amount) => { if (ledger) ledger[group][key] = (ledger[group][key] || 0) + amount; };
  c.H.__auditData = (S, reg, amount, bid) => { add('income', bid || 'production-unknown', amount); };
  const grant = E.grant;
  E.grant = function (S, rid, rw, src) { const r = grant(S, rid, rw, src); add('income', src || 'grant-other', r.data || 0); return r; };
  const chest = E.openChest;
  E.openChest = function (S, id) { const r = chest(S, id); if (r.ok) add('income', 'chest', r.data); return r; };
  for (const [method, key] of [['buyResearch', 'research'], ['promote', 'promotion']]) {
    const fn = E[method]; E[method] = function (S, ...args) { const before = S.perm.data, frag = S.perm.frags; const r = fn(S, ...args); if (r.ok) { add('spent', key, before - S.perm.data); if (key === 'research') add('spent', 'fragmentResearch', frag - S.perm.frags); } return r; };
  }
  return { use: l => { ledger = l; } };
}
function newLedger(S) { return { initialData: S.perm.data, income: {}, spent: {}, milestones: {}, regions: {}, samples: [], anomalies: [], oracleFirst: null, oracleMax: 0 }; }
function summary(S, D, E, l, info) {
  const levels = info.ids.reduce((a, id) => a + (S.perm.research[id] || 0), 0);
  const maxNodes = info.ids.filter(id => (S.perm.research[id] || 0) >= D.research[id].max).length;
  const observatories = {};
  for (const rid of D.regionOrder) {
    const reg = S.run.regions[rid]; if (!reg.unlocked) continue;
    for (const bid of ['observatorio', 'obs_profundo']) if (reg.b[bid] && reg.b[bid].n) {
      const bs = reg.b[bid]; observatories[rid + '/' + bid] = { n: bs.n, level: bs.lvl, rateTheoretical: round(E.bRate(S, rid, bid, E.mods(S))), energyRatio: round(reg.en.ratio), reason: bs.why || '', efficiency: bs.eff === undefined ? null : round(bs.eff) };
    }
  }
  const income = Object.values(l.income).reduce((a, x) => a + x, 0), spent = (l.spent.research || 0) + (l.spent.promotion || 0);
  return { time: S.run.time, researchLevels: levels, researchPercent: round(levels / info.levels * 100), maxNodes, data: round(S.perm.data), grossData: round(income), oracle: S.perm.specs.oraculo && S.perm.specs.oraculo.lvl || 0, fragments: S.perm.fragsTotal || 0, canCollapse: E.canCollapse(S), missions: Object.keys(S.run.missions).length, observatories, income: Object.fromEntries(Object.entries(l.income).map(([k, v]) => [k, round(v)])), spent: Object.fromEntries(Object.entries(l.spent).map(([k, v]) => [k, round(v)])), reconciliationError: round(l.initialData + income - spent - S.perm.data) };
}
function sample(S, D, E, l, info) {
  const s = summary(S, D, E, l, info);
  for (const p of [25, 50, 75, 100]) if (s.researchPercent >= p && l.milestones['research' + p] === undefined) l.milestones['research' + p] = S.run.time;
  if (s.oracle) { if (l.oracleFirst === null) l.oracleFirst = S.run.time; l.oracleMax = Math.max(l.oracleMax, s.oracle); }
  for (const rid of D.regionOrder) if (S.run.regions[rid].unlocked && l.regions[rid] === undefined) l.regions[rid] = S.run.time;
  if (Math.floor(S.run.time) % 300 === 0) l.samples.push(s);
  return s;
}
function invariant(S, D) {
  if (S.perm.data < -1e-6 || !isFinite(S.perm.data)) throw new Error('Dados inválidos');
  for (const rid of D.regionOrder) for (const [r, x] of Object.entries(S.run.regions[rid].st)) if (x < -1e-6 || !isFinite(x)) throw new Error('Recurso inválido ' + rid + '.' + r);
}
function farm(S, c) {
  const { E } = c.H, helper = c.module.exports.auditHelpers;
  if (!S.perm.specs.oraculo) return;
  for (const rid of ['lua', 'marte']) {
    if (!S.run.regions[rid].unlocked || !E.bAvail(S, rid, 'observatorio')) continue;
    const bs = S.run.regions[rid].b.observatorio;
    if (!bs || bs.n < 10) helper.tryBuild(S, rid, 'observatorio', 0);
    else if (bs.lvl < 5) helper.tryUpgrade(S, rid, 'observatorio', 0);
  }
  for (let i = 0; i < 20; i++) helper.buyResearch(S, true);
}
function holdFirstUniverse(serialized, strategy, options = {}) {
  const c = load(), { DATA: D, E } = c.H, { botStep } = c.module.exports;
  if (options.configure) options.configure(c.H, c.module.exports);
  const loaded = E.deserialize(serialized); if (!loaded.ok) throw new Error(loaded.err);
  const S = loaded.S, info = researchInfo(D, E), l = newLedger(S), metered = instrument(c); metered.use(l);
  // O bot mantém este conjunto fora do save; reconstrói as pausas temporárias ao criar o ramo de medição.
  for (const rid of D.regionOrder) for (const [bid, bs] of Object.entries(S.run.regions[rid].b)) if (bs.pause) c.module.exports.auditHelpers.botPaused.add(rid + '|' + bid);
  const start = summary(S, D, E, l, info), until = S.run.time + (options.extensionSec === undefined ? 4 * 3600 : options.extensionSec);
  while (S.run.time < until) { E.tick(S, 1); E.tick(S, 1); botStep(S); if (strategy === 'farm') farm(S, c); sample(S, D, E, l, info); }
  invariant(S, D);
  return { start, end: summary(S, D, E, l, info), milestones: l.milestones, samples: l.samples };
}
function runScenario(universe, strategy, options = {}) {
  const started = Date.now(), c = load(), { DATA: D, E } = c.H, { botStep } = c.module.exports;
  if (options.configure) options.configure(c.H, c.module.exports);
  const instrumented = instrument(c), info = researchInfo(D, E);
  const S = E.newState(); S.run.universe = universe; S.lastTick = Date.now();
  const result = { universe, strategy, variant: options.label || 'current', researchBudget: info, cycles: [] }, states = [];
  const maxCycles = options.cycles || 2;
  for (let cycle = 1; cycle <= maxCycles; cycle++) {
    const l = newLedger(S); instrumented.use(l);
    let ready = false;
    while (S.run.time < (options.maxH || 12) * 3600) {
      E.tick(S, 1); E.tick(S, 1); botStep(S); if (strategy === 'farm') farm(S, c);
      const snap = sample(S, D, E, l, info);
      if (Math.floor(S.run.time) % 60 === 0) invariant(S, D);
      if (snap.canCollapse) { ready = true; break; }
    }
    const end = summary(S, D, E, l, info); invariant(S, D);
    states.push(JSON.parse(E.serialize(S)));
    const row = { cycle, universe: S.run.universe, collapseReady: ready, ...end, milestones: l.milestones, oracleFirst: l.oracleFirst, regions: l.regions, samples: l.samples };
    result.cycles.push(row);
    console.log(JSON.stringify({ event: 'campaign', universe, strategy, cycle, time: round(S.run.time / 60), data: end.data, researchPercent: end.researchPercent, oracle: end.oracle, sources: end.income, reconciliationError: end.reconciliationError }));
    if (cycle === 1 && ready) result.firstUniverseExtended = holdFirstUniverse(E.serialize(S), strategy, options);
    if (!ready || cycle === maxCycles) break;
    const next = E.collapseOffer(S)[0]; const collapsed = E.doCollapse(S, next); if (!collapsed.ok) throw new Error('Colapso falhou');
  }
  // Após o segundo Colapso estar disponível, continua mais 4h no mesmo universo, sem reset.
  const before = summary(S, D, E, { initialData: S.perm.data, income: {}, spent: {} }, info);
  const extended = newLedger(S); instrumented.use(extended); const until = S.run.time + (options.extensionSec === undefined ? 4 * 3600 : options.extensionSec);
  while (S.run.time < until) { E.tick(S, 1); E.tick(S, 1); botStep(S); if (strategy === 'farm') farm(S, c); sample(S, D, E, extended, info); }
  invariant(S, D); const after = summary(S, D, E, extended, info);
  result.extended = { start: before, end: after, milestones: extended.milestones, samples: extended.samples };
  result.realSeconds = round((Date.now() - started) / 1000);
  console.log(JSON.stringify({ event: 'extended', universe, strategy, time: round(S.run.time / 60), data: after.data, researchPercent: after.researchPercent, oracle: after.oracle, sources: after.income, realSeconds: result.realSeconds }));
  return { result, states };
}
module.exports = { load, runScenario, researchInfo, farm };
if (require.main === module) {
const scenarios = quick ? [['padrao', 'baseline'], ['padrao', 'farm']] : [['padrao', 'baseline'], ['abundante', 'baseline'], ['energetico', 'baseline'], ['congelado', 'baseline'], ['ancestral', 'baseline'], ['padrao', 'farm']];
const results = [], states = [];
for (const [universe, strategy] of scenarios) { const r = runScenario(universe, strategy); results.push(r.result); states.push({ universe, strategy, cycles: r.states }); }
fs.mkdirSync(path.join(ROOT, 'artifacts'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'artifacts/campanhas-balanceamento.json'), JSON.stringify({ generatedAt: new Date().toISOString(), method: 'bot original, ações a cada 2s, 2 Colapsos disponíveis, mais 4h sem reset; farm compra até10 observatórios Nv5 em Lua/Marte com custos reais', results }, null, 2));
fs.writeFileSync(path.join(ROOT, 'artifacts/campanhas-estados.json'), JSON.stringify(states));
console.log('Resultados: artifacts/campanhas-balanceamento.json; estados: artifacts/campanhas-estados.json');
}
