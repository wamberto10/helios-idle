/* Auditoria de ciência. Fixtures controladas, não uma campanha do zero.
   Não altera data.js/engine.js, salvamentos ou dados do navegador.
   Uso: node tools/auditoria-pesquisa.js [arquivo-json]
*/
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const project = path.resolve(__dirname, '..');
function loadEngine(variant = 'atual') {
  const context = { console, Date, Buffer }; context.globalThis = context; vm.createContext(context);
  for (const file of ['data.js', 'engine.js']) vm.runInContext(fs.readFileSync(path.join(project, 'js', file), 'utf8'), context, { filename: file });
  const { DATA: D, E } = context.H;
  if (variant === 'apenas-tempo-120') { D.buildings.observatorio.t = 120; return context.H; }
  if (variant !== 'atual') {
    // Experimento somente em memória: ciência tem escala de velocidade própria;
    // rendimento de fragmentos não amplia dados; velocidade global atua por raiz quadrada.
    const scienceSpeed = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12];
    const originalMods = E.mods, originalYield = E.yieldOf, originalSpeed = E.speedOf;
    E.mods = S => {
      const m = originalMods(S), lvl = S.perm.specs.oraculo && S.perm.specs.oraculo.lvl;
      m.scienceSpeed = (lvl ? scienceSpeed[lvl] : 1) * Math.sqrt(m.globalSpeed);
      return m;
    };
    E.speedOf = (def, m) => def.out && def.out.data ? m.scienceSpeed : originalSpeed(def, m);
    E.yieldOf = (def, bs, r, m) => originalYield(def, bs, r, m) / (r === 'data' ? m.globalYield : 1);
    if (variant === 'ciencia-e-custos') {
      for (const n of Object.values(D.research)) if (n.cur !== 'frag') {
        // Preserva o primeiro nível; aumenta a profundidade das compras posteriores.
        const e = n.max;
        n.cost *= 1;
        n.cg = Math.max(n.cg, e > 3 ? 2.8 : 3);
      }
    }
  }
  return context.H;
}
const base = loadEngine(), D = base.DATA, E = base.E;
function budget(H) {
  const branches = {}, nodes = [];
  for (const [id, def] of Object.entries(H.DATA.research)) {
    const currency = def.cur === 'frag' ? 'frag' : 'data';
    const costs = Array.from({ length: def.max }, (_, lvl) => H.E.resCost(id, lvl));
    const total = costs.reduce((a, b) => a + b, 0), group = currency === 'frag' ? 'frag' : def.br;
    branches[group] ||= { total: 0, levels: 0, nodes: 0 };
    branches[group].total += total; branches[group].levels += def.max; branches[group].nodes++;
    nodes.push({ id, name: def.name, currency, costs, total, max: def.max, requirements: def.req || [] });
  }
  return { branches, nodes, dataTotal: nodes.filter(n => n.currency === 'data').reduce((a, n) => a + n.total, 0), fragmentTotal: branches.frag.total };
}
function setup(H, options) {
  const { E, DATA: D } = H, S = E.newState();
  for (const rid of D.regionOrder) { S.run.regions[rid].unlocked = false; S.run.regions[rid].b = {}; }
  const rid = options.building === 'obs_profundo' ? 'netuno' : 'lua', reg = S.run.regions[rid];
  reg.unlocked = true; reg.phase = D.regions[rid].phases.length;
  reg.b = { painel: { n: 1000, lvl: 1 }, [options.building || 'observatorio']: { n: options.n, lvl: options.lvl, p: 0 } };
  // Netuno não permite Painel no jogo real. Fixture usa reator abundante para isolar ciência.
  if (rid === 'netuno') { delete reg.b.painel; reg.b.reator = { n: 1000, lvl: 1 }; reg.st.cryo = 1e12; }
  S.perm.specs.oraculo = { lvl: options.oraculo, cards: 0 };
  if (options.telemetria) { S.perm.research.exp1 = 1; S.perm.research.exp4 = options.telemetria; }
  if (options.globalSpeed) S.perm.research.sg3 = options.globalSpeed;
  if (options.eco) S.perm.specs.eco = { lvl: options.eco, cards: 0 };
  S.perm.fragsTotal = options.frags || 0; S.perm.data = 0;
  return { S, rid, bid: options.building || 'observatorio' };
}
function measure(H, options, seconds = 60) {
  const { S, rid, bid } = setup(H, options), m = H.E.mods(S);
  const expected = H.E.bRate(S, rid, bid, m), energy = H.E.regionEnergy(S, rid, m);
  const rep = H.E.simulate(S, seconds), measured = S.perm.data / seconds;
  if (Math.abs(expected - measured) > Math.max(1e-7, expected * 1e-7)) throw new Error('Fórmula e motor divergem: ' + JSON.stringify({ options, expected, measured }));
  return { ...options, seconds, rate: measured, gained: S.perm.data, expected, energyRatio: energy.ratio, dataGain: m.dataGain, globalYield: m.globalYield, globalSpeed: m.globalSpeed, cap: H.E.offlineCapSec(S), report: rep.data };
}
function fullResearch(H, options, policy = 'science-first', maxHours = 168) {
  const { S } = setup(H, options), ids = Object.keys(H.DATA.research).filter(id => H.DATA.research[id].cur !== 'frag');
  const initialSpent = ids.reduce((sum, id) => sum + Array.from({ length: S.perm.research[id] || 0 }, (_, i) => H.E.resCost(id, i)).reduce((a, b) => a + b, 0), 0);
  const snapshots = [], mark = [3600, 7200, 14400, 28800, 86400];
  let spent = 0, completeAt = null, produced = 0;
  for (let t = 0; t <= maxHours * 3600; t++) {
    for (let buy = 0; buy < 120; buy++) {
      const remaining = ids.map(id => ({ id, st: H.E.resState(S, id) })).filter(x => !x.st.max && !x.st.locked);
      let next;
      if (policy === 'science-first' && !(S.perm.research.exp1 > 0)) next = remaining.find(x => x.id === 'exp1');
      else if (policy === 'science-first' && (S.perm.research.exp4 || 0) < H.DATA.research.exp4.max) next = remaining.find(x => x.id === 'exp4');
      else next = remaining.filter(x => x.st.can).sort((a, b) => a.st.cost - b.st.cost)[0];
      if (!next || !next.st.can) break;
      spent += next.st.cost; H.E.buyResearch(S, next.id);
    }
    const levels = ids.reduce((a, id) => a + (S.perm.research[id] || 0), 0);
    if (mark.includes(t)) snapshots.push({ time: t, levels, bank: S.perm.data, produced, spent });
    if (ids.every(id => S.perm.research[id] === H.DATA.research[id].max)) { completeAt = t; break; }
    const before = S.perm.data; H.E.tick(S, 1); produced += S.perm.data - before;
  }
  return { options, policy, completeAt, initialSpent, spent, produced, bank: S.perm.data, snapshots, maxHours };
}
const rateGrid = [];
for (const n of [1, 5, 10, 25]) for (const lvl of [1, 5, 10, 25]) for (const oraculo of [1, 3, 5, 10]) rateGrid.push(measure(base, { n, lvl, oraculo }));
const cases = [
  { label: 'Primeiro observatório automatizado', n: 1, lvl: 1, oraculo: 1 },
  { label: 'Farm moderado sem prestígio', n: 5, lvl: 5, oraculo: 3 },
  { label: 'Farm ativo sem prestígio', n: 10, lvl: 5, oraculo: 3 },
  { label: 'Farm ativo com Telemetria V', n: 10, lvl: 5, oraculo: 3, telemetria: 5 },
  { label: 'Farm forte com Telemetria V', n: 10, lvl: 10, oraculo: 5, telemetria: 5 },
  { label: 'Stress máximo, não campanha atingida', n: 25, lvl: 25, oraculo: 10, telemetria: 5 },
  { label: 'Farm herdado ilustrativo,100 fragmentos', n: 10, lvl: 5, oraculo: 5, telemetria: 5, frags: 100, globalSpeed: 5, eco: 1 },
  { label: 'Profundo abastecido, cenário controlado', building: 'obs_profundo', n: 2, lvl: 2, oraculo: 3, telemetria: 5 },
];
const offline = cases.map(c => ({ ...measure(base, c, 8 * 3600), researchBudgets: measure(base, c).rate * 28800 / budget(base).dataTotal }));
const active = [cases[0], cases[1], cases[2], cases[4], cases[6]];
const completion = active.map(c => fullResearch(base, c));
const proposalA = loadEngine('ciencia-isolada'), proposalB = loadEngine('ciencia-e-custos'), proposalT = loadEngine('apenas-tempo-120');
const proposals = [proposalA, proposalB, proposalT].map((H, i) => ({ name: ['ciencia-isolada', 'ciencia-e-custos', 'apenas-tempo-120'][i], budget: budget(H), completion: [cases[1], cases[2], cases[4], cases[6]].map(c => fullResearch(H, c)), offline: [cases[1], cases[2], cases[4], cases[6]].map(c => measure(H, c, 28800)) }));
const output = {
  generated: new Date().toISOString(),
  methodology: 'Ensaios controlados com energia artificialmente suficiente. Fixação de máquinas/níveis/cartas não mede o tempo ou o custo de atingi-los. Sem missões, baús, expedições nem outras fontes de dados. A cada segundo o motor real produz e compras reais respeitam req/custos. Science-first poupa primeiro para exp1 I e Telemetria V; depois compra a opção disponível mais barata.',
  baseBudget: budget(base), rateGrid, offline, completion, proposals,
  finding: 'DataGain é aplicado uma única vez em produção manual/automática. A inflação decorre da composição velocidade de Oráculo, nível/rendimento, multiplicadores permanentes e produção sem insumos no observatório simples. Os níveis avançados de cada ramo exigem a descoberta do planeta correspondente (missão-marco), além dos dados.',
};
const dest = process.argv[2] || path.join(project, 'artifacts', 'auditoria-pesquisa.json'); fs.mkdirSync(path.dirname(path.resolve(dest)), { recursive: true }); fs.writeFileSync(dest, JSON.stringify(output, null, 2));
console.log(JSON.stringify({ budget: output.baseBudget.branches, offline: offline.map(c => ({ label: c.label, rate: c.rate, data8h: c.gained, budgets: c.researchBudgets })), completion: completion.map(c => ({ label: c.options.label, hours: c.completeAt === null ? null : c.completeAt / 3600 })), proposals: proposals.map(p => ({ name: p.name, budget: p.budget.dataTotal, completion: p.completion.map(c => ({ label: c.options.label, hours: c.completeAt === null ? null : c.completeAt / 3600 })) })), file: dest }, null, 2));
