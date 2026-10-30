/* Compara estratégias de investimento com o motor real e o bot (ações a cada 2s de jogo).
   node tools/comparar-estrategias.js [universo] [ciclos]
   Cada estratégia = bot normal + um investimento extra pago com recursos reais. Mediana de 3 inícios
   ligeiramente diferentes (0, 7 e 13 s parados) para reduzir a variância da logística do bot.
   Resultado em artifacts/comparacao-estrategias.json. Não lê saves pessoais. */
'use strict';
const fs = require('fs'), path = require('path');
const sim = require('./simular-campanhas');
const ROOT = path.resolve(__dirname, '..');
const uni = process.argv[2] || 'padrao'; const cycles = +(process.argv[3] || 1);
const OFFSETS = [0, 7, 13];
const median = (a) => { const b = a.filter((x) => x != null).sort((x, y) => x - y); return b.length ? b[Math.floor((b.length - 1) / 2)] : null; };

const STRATS = {
  normal: { desc: 'bot normal (pesquisa quando custa menos que metade do saldo)', fn: () => {} },
  pesquisa: { desc: 'compra pesquisa assim que pode', fn: (S, c, h) => { for (let i = 0; i < 20; i++) h.buyResearch(S, true); } },
  observatorios: { desc: 'até 10 observatórios Nv.5 na Lua e em Marte (pesquisa no ritmo normal)', fn: (S, c, h) => obs(S, c, h) },
  farm: { desc: 'observatórios + pesquisa imediata (o farm científico das auditorias)', fn: (S, c, h) => { obs(S, c, h); for (let i = 0; i < 20; i++) h.buyResearch(S, true); } },
  industria: { desc: 'melhora refinarias, forjas e fábricas da Lua e de Marte até o Nv.5', fn: (S, c, h) => lvlUp(S, c, h, ['refinaria', 'forja', 'fabrica'], ['lua', 'marte'], 5) },
  energia: { desc: 'mantém geração ≥ 1,5× o consumo em todas as regiões', fn: (S, c, h) => { const { E } = c.H; const m = E.mods(S); for (const rid of c.H.DATA.regionOrder) { const reg = S.run.regions[rid]; if (reg.unlocked && reg.en.gen < reg.en.use * 1.5) h.ensurePower(S, rid, 0); } } },
  expansao: { desc: 'sem observatórios extras: amplia refino, forjas, armazéns e geração na Lua e em Marte (como o farm faz para pagar os observatórios)', fn: (S, c, h) => expand(S, c, h) },
  logistica: { desc: 'melhora todos os cargueiros até o Nv.5', fn: (S, c, h) => { const { E } = c.H; for (const rt of S.run.routes) if (rt.lvl < 5) { const cost = E.routeUpCost(S, rt); if (E.afford(S.run.regions[rt.from], cost)) E.upgradeRoute(S, rt.id); } } },
};
function obs(S, c, h) {
  const { E } = c.H; if (!S.perm.specs.oraculo) return;
  for (const rid of ['lua', 'marte']) {
    if (!S.run.regions[rid].unlocked || !E.bAvail(S, rid, 'observatorio')) continue;
    const bs = S.run.regions[rid].b.observatorio;
    if (!bs || bs.n < 10) h.tryBuild(S, rid, 'observatorio', 0); else if (bs.lvl < 5) h.tryUpgrade(S, rid, 'observatorio', 0);
  }
}
function expand(S, c, h) {
  const { E } = c.H; if (!S.perm.specs.oraculo) return;
  for (const rid of ['lua', 'marte']) {
    const reg = S.run.regions[rid]; if (!reg.unlocked) continue;
    const want = { refinaria: rid === 'lua' ? 12 : 16, forja: rid === 'lua' ? 9 : 7, armazem: 11 };
    for (const b in want) if (E.bAvail(S, rid, b) && (!reg.b[b] || reg.b[b].n < want[b])) h.tryBuild(S, rid, b, 0);
    if (reg.en.gen < reg.en.use * 1.3) h.ensurePower(S, rid, 0);
  }
}
function lvlUp(S, c, h, bids, rids, max) {
  const { E } = c.H;
  for (const rid of rids) { const reg = S.run.regions[rid]; if (!reg.unlocked) continue; for (const b of bids) { const bs = reg.b[b]; if (bs && bs.n && bs.lvl < max && E.afford(reg, E.uCost(S, rid, b))) E.upgrade(S, rid, b); } }
}
function run(name, off) {
  const c = sim.load(), { E } = c.H, { botStep } = c.module.exports, h = c.module.exports.auditHelpers;
  const S = E.newState(); S.run.universe = uni; S.lastTick = 1e12;
  for (let i = 0; i < off; i++) E.tick(S, 1);
  const out = []; let t0 = S.run.time; let oracle = null;
  for (let k = 0; k < cycles; k++) {
    let ok = false;
    while (S.run.time - t0 < 12 * 3600) {
      E.tick(S, 1); E.tick(S, 1); botStep(S); STRATS[name].fn(S, c, h);
      if (oracle === null && S.perm.specs.oraculo) oracle = S.run.time;
      if (E.canCollapse(S)) { ok = true; break; }
    }
    const ids = Object.keys(c.H.DATA.research).filter((id) => c.H.DATA.research[id].cur !== 'frag' && !c.H.DATA.research[id].opt);
    const lv = ids.reduce((a, id) => a + (S.perm.research[id] || 0), 0), tot = ids.reduce((a, id) => a + c.H.DATA.research[id].max, 0);
    out.push({ min: ok ? Math.round((S.run.time - t0) / 60) : null, research: Math.round(100 * lv / tot), oracleLvl: (S.perm.specs.oraculo || {}).lvl || 0 });
    if (!ok) break; E.doCollapse(S, E.collapseOffer(S)[0]); t0 = S.run.time;
  }
  return { out, oracleMin: oracle === null ? null : Math.round(oracle / 60) };
}
const result = { generatedAt: new Date().toISOString(), universe: uni, cycles, offsets: OFFSETS, method: 'Tempo de bot (ações instantâneas a cada 2s): serve para comparar estratégias, não para prever o tempo de uma pessoa.', rows: [] };
const ONLY = (process.env.ESTRATEGIAS || '').split(',').filter(Boolean);
for (const name of Object.keys(STRATS).filter((n) => !ONLY.length || ONLY.includes(n))) {
  const runs = OFFSETS.map((o) => run(name, o));
  const row = { strategy: name, desc: STRATS[name].desc };
  for (let k = 0; k < cycles; k++) { row['c' + (k + 1)] = median(runs.map((r) => r.out[k] && r.out[k].min)); row['research' + (k + 1)] = median(runs.map((r) => r.out[k] && r.out[k].research)); }
  row.oracleMin = median(runs.map((r) => r.oracleMin)); row.runs = runs.map((r) => r.out.map((x) => x.min));
  result.rows.push(row);
  console.log(JSON.stringify(row));
}
fs.mkdirSync(path.join(ROOT, 'artifacts'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'artifacts/comparacao-estrategias' + (uni === 'padrao' ? '' : '-' + uni) + '.json'), JSON.stringify(result, null, 2));
