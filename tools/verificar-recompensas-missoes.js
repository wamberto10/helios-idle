/* Verificação somente de leitura das definições do jogo. Não acessa saves do jogador. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const root = path.resolve(__dirname, '..');
const ctx = vm.createContext({ console, Date, Math, JSON, setTimeout, clearTimeout });
const sources = ['data.js', 'engine.js'].map(file => {
  const source = fs.readFileSync(path.join(root, 'js', file), 'utf8');
  vm.runInContext(source, ctx, { filename: file });
  return { file: 'js/' + file, sha256: crypto.createHash('sha256').update(source).digest('hex') };
});
const { DATA: D, E } = ctx.H;
const sum = xs => xs.reduce((a, b) => a + b, 0);
const round = n => Math.round(n * 1e6) / 1e6;
const rows = D.regionOrder.flatMap(rid => D.regions[rid].phases.flatMap((phase, phaseIndex) => phase.missions.map((md, i) => ({
  id: `${rid}.${phaseIndex}.${i}`, rid, phase: phase.name, type: md.t, target: md.n,
  building: md.b, resource: md.r, title: E.mTitle(md), reward: md.rw || {},
  onlyData: !!md.rw?.data && Object.keys(md.rw).every(k => k === 'data'),
}))));
const regions = D.regionOrder.map(rid => {
  const all = rows.filter(x => x.rid === rid);
  return { rid, name: D.regions[rid].name, count: all.length, onlyData: all.filter(x => x.onlyData).length,
    baseData: sum(all.map(x => x.reward.data || 0)),
    nonData: all.filter(x => !x.onlyData).map(x => ({ id: x.id, title: x.title, reward: x.reward })) };
});
function obs(count, lvl, oracle, exp4, frags, sg3, eco) {
  const S = E.newState(), reg = S.run.regions.lua;
  reg.phase = 3; reg.b = { observatorio: { n: count, lvl, p: 0 } };
  S.perm.specs.oraculo = { lvl: oracle, cards: 0 };
  if (eco) S.perm.specs.eco = { lvl: eco, cards: 0 };
  S.perm.research = { exp4, sg3 }; S.perm.fragsTotal = frags;
  const m = E.mods(S), demand = E.useOf(D.buildings.observatorio, count, m);
  reg.b.painel = { n: Math.ceil(demand / E.genOf(S, 'lua', 'painel', m, 1, 1)), lvl: 1, p: 0 };
  const rate = E.bRate(S, 'lua', 'observatorio', m), before = S.perm.data;
  E.simulate(S, 3600);
  if (Math.abs(S.perm.data - before - rate * 3600) > .01) throw new Error('Divergência produção observatórios');
  return { count, lvl, oracle, exp4, frags, sg3, eco, rate: round(rate), dataPerHour: round(rate * 3600),
    reward100Actual: Math.round(100 * m.dataGain), reward100EquivalentSeconds: round(Math.round(100 * m.dataGain) / rate),
    note: 'Instalação controlada com energia suficiente, não tempo medido para adquirir esta base.' };
}
const controlledRates = [obs(1, 1, 1, 0, 0, 0, 0), obs(5, 5, 3, 0, 0, 0, 0), obs(10, 5, 3, 5, 0, 0, 0), obs(8, 8, 5, 5, 100, 2, 1)];
function cumulativeProof() {
  const S = E.newState(), reg = S.run.regions.lua;
  reg.phase = 1; reg.stats.prod.metal = 100; // progresso feito antes da missão ficar visível
  const md = D.regions.lua.phases[1].missions[1];
  const prodBefore = E.mProg(S, 'lua', md, 'lua.1.1');
  S.perm.research.min1 = 1;
  const researchMission = D.regions.lua.phases[1].missions[5];
  const firstResearch = E.mProg(S, 'lua', researchMission, 'lua.1.5');
  S.perm.collapses = 1; S.run = E.newRun(S, 'abundante'); S.run.regions.lua.phase = 1;
  const nextResearch = E.mProg(S, 'lua', researchMission, 'lua.1.5');
  const recruitMission = D.regions.lua.phases[0].missions[3];
  const targets = [0, 1, 6, 10].map(n => { S.perm.collapses = n; return { collapses: n, ordinaryProd: E.mTarget(S, 'lua', md, E.mods(S)), recruitCycles: E.mTarget(S, 'lua', recruitMission, E.mods(S)) }; });
  return { productionBeforeVisible: prodBefore, researchFirstRun: firstResearch, researchAfterCollapse: nextResearch, scaledTargets: targets,
    notes: ['Metas prod/cycles/deliver usam contadores da região desde o início do universo; exped usa contador global do universo.', 'Pesquisa/promote usam estado permanente: metas podem estar satisfeitas ao aparecer em universos seguintes. Isso é regra atual, não duplicação de recompensa.', 'Recrutamento repetido rende uma carta, enquanto o objetivo de ciclos ainda pode ter de ser realizado outra vez.'] };
}
const totalData = sum(rows.map(x => x.reward.data || 0));
const phases = sum(D.regionOrder.map(rid => D.regions[rid].phases.length));
const report = {
  generatedAt: new Date().toISOString(), changesApplied: false, sources,
  budget: { missions: rows.length, phases, onlyData: rows.filter(x => x.onlyData).length, baseData: totalData,
    chestBaseData: sum(Array.from({ length: phases }, (_, i) => D.chest(i).data)),
    chestCards: sum(Array.from({ length: phases }, (_, i) => D.chest(i).cards)),
    rewardKinds: Object.fromEntries(['spec', 'res', 'cards', 'unlock', 'frags'].map(k => [k, rows.filter(x => x.reward[k]).length])),
    note: 'Baús por ordem global de conclusão de fase, antes de multiplicadores. Recursos e desbloqueios de fase não foram convertidos em dados.' },
  regions, typeCounts: Object.fromEntries([...new Set(rows.map(x => x.type))].map(t => [t, rows.filter(x => x.type === t).length])),
  controlledRates, cumulativeProof: cumulativeProof(), rows,
  recommendations: [
    'Preservar dados e recursos de Pouso/Posto de Extração: sustentam primeiras pesquisas e evitam uma trava antes de automatizar.',
    'Dar função explícita a um objetivo-chave de cada fase posterior: descoberta tecnológica permanente, projeto novo ou cartas do especialista regional já recrutado; dados continuam complemento.',
    'Vincular tecnologias avançadas a descobertas, sem exigir a própria pesquisa/produção antes de liberar a máquina que a obtém. Conservar descoberta e pesquisa comprada no Colapso.',
    'Não multiplicar recompensas pela taxa de observatórios do jogador: isso premia a fonte inflacionada e realimenta o problema.',
    'Manter metas cumulativas do tutorial explícitas; em objetivos novos, usar marcos diferentes em vez de exigir novamente produção já feita. Tratar missões de pesquisa permanentes como verificação de marco, sem desfazer pesquisas.',
    'Não aumentar todas as metas de missões após Colapso como correção isolada; o ganho permanente ainda cresce e o limite de metas chega a quatro vezes em seis Colapsos.',
  ],
};
fs.writeFileSync(path.join(root, 'artifacts', 'verificacao-missoes-atual.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ budget: report.budget, regions, controlledRates, cumulativeProof: report.cumulativeProof }, null, 2));
