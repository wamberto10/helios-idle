/* Ausência real de 8 horas (E.applyOffline, a mesma função usada ao voltar ao jogo).
   node tools/verificar-offline.js [universo]
   Joga com o bot até cada ponto de controle, salva, aplica 8h offline numa cópia e mede o que mudou.
   Não lê saves pessoais. Resultado em artifacts/verificacao-offline.json. */
'use strict';
const fs = require('fs'), path = require('path');
const sim = require('./simular-campanhas');
const ROOT = path.resolve(__dirname, '..');
const uni = process.argv[2] || 'padrao';
const HOURS = 8;
const round = (x) => Math.round(x * 100) / 100;

function play(strategy, stop) {
  const c = sim.load(), { E } = c.H, { botStep } = c.module.exports;
  const S = E.newState(); S.run.universe = uni; S.lastTick = 1e12;
  let collapses = 0, t0 = 0;
  while (S.run.time < 12 * 3600) {
    E.tick(S, 1); E.tick(S, 1); botStep(S); if (strategy === 'farm') sim.farm(S, c);
    if (stop(S, collapses, S.run.time - t0)) break;
    if (E.canCollapse(S)) {
      if (stop(S, collapses, S.run.time - t0, true)) break;
      E.doCollapse(S, E.collapseOffer(S)[0]); collapses++; t0 = S.run.time;
    }
  }
  return { c, S };
}
function researchSnapshot(H, S) {
  const { DATA: D, E } = H; const ids = Object.keys(D.research).filter((id) => D.research[id].cur !== 'frag' && !D.research[id].opt);
  const levels = ids.reduce((a, id) => a + (S.perm.research[id] || 0), 0), total = ids.reduce((a, id) => a + D.research[id].max, 0);
  let remaining = 0; for (const id of ids) for (let l = S.perm.research[id] || 0; l < D.research[id].max; l++) remaining += E.resCost(id, l);
  // quantos níveis o saldo compraria agora, respeitando requisitos e descobertas (numa cópia)
  const T = JSON.parse(JSON.stringify({ perm: S.perm, run: S.run })); let can = 0;
  for (;;) { let best = null, bc = Infinity; for (const id of ids) { const st = E.resState(T, id); if (st.max || !st.can) continue; if (st.cost < bc) { bc = st.cost; best = id; } } if (!best) break; E.buyResearch(T, best); can++; }
  const blocked = ids.filter((id) => { const st = E.resState(S, id); return !st.max && st.disc; }).length;
  return { levels, total, percent: round(100 * levels / total), remainingCost: Math.round(remaining), affordableLevels: can, nodesWaitingDiscovery: blocked };
}
const points = [
  { label: '30 min do 1º universo', fn: (S, k, t) => k === 0 && t >= 1800 },
  { label: '60 min do 1º universo', fn: (S, k, t) => k === 0 && t >= 3600 },
  { label: 'Colapso disponível no 1º universo', fn: (S, k, t, ready) => k === 0 && ready },
  { label: '20 min do 2º universo', fn: (S, k, t) => k === 1 && t >= 1200 },
];
const out = { generatedAt: new Date().toISOString(), universe: uni, hours: HOURS, method: 'Bot até o ponto de controle; cópia do save recebe E.applyOffline com ' + HOURS + 'h de ausência (limite offline do jogo respeitado). Nada é comprado nem resgatado durante a ausência.', rows: [] };
for (const strategy of ['baseline', 'farm']) for (const p of points) {
  const { c, S } = play(strategy, p.fn); const { E } = c.H;
  const before = researchSnapshot(c.H, S);
  const r = E.deserialize(E.serialize(S)); if (!r.ok) throw new Error(r.err);
  const T = r.S; const d0 = T.perm.data, res0 = JSON.stringify(T.perm.research), mis0 = Object.keys(T.run.missions).length;
  const rep = E.applyOffline(T, T.lastTick + HOURS * 3600e3);
  const after = researchSnapshot(c.H, T);
  const row = { strategy, point: p.label, gameMinutes: round(S.run.time / 60), oracle: (T.perm.specs.oraculo || {}).lvl || 0,
    offlineUsedHours: round(rep.used / 3600), dataBefore: Math.round(d0), dataGained: Math.round(T.perm.data - d0),
    researchUnchanged: JSON.stringify(T.perm.research) === res0, missionsUnchanged: Object.keys(T.run.missions).length === mis0,
    missionsReadyAfter: rep.missions.length, research: { before, after },
    canBuyWholeRemainingTree: after.affordableLevels >= after.total - after.levels };
  out.rows.push(row);
  console.log(JSON.stringify({ strategy, point: p.label, min: row.gameMinutes, ganho: row.dataGained, pesquisa: before.percent + '%', compraria: after.affordableLevels + '/' + (after.total - after.levels), aguardandoDescoberta: after.nodesWaitingDiscovery, semCompras: row.researchUnchanged && row.missionsUnchanged }));
}
fs.mkdirSync(path.join(ROOT, 'artifacts'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'artifacts/verificacao-offline.json'), JSON.stringify(out, null, 2));
console.log('Resultado em artifacts/verificacao-offline.json');
