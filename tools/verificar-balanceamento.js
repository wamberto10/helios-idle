/* Verificação posterior à auditoria, sem modificar o jogo ou ler saves pessoais.
   node tools/verificar-balanceamento.js [--quick]
   Preserva os artefatos históricos; resultados em artifacts/verificacao-*.json. */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { runScenario } = require('./simular-campanhas');
const ROOT = path.resolve(__dirname, '..');
const round = n => Math.round(n * 1000) / 1000;
const sources = ['js/data.js', 'js/engine.js', 'js/ui.js', 'tools/bot.js'].map(file => ({
  file, sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, file))).digest('hex'),
}));
const previous = JSON.parse(fs.readFileSync(path.join(ROOT, 'artifacts/auditoria-missoes.json'), 'utf8'));
const comparison = sources.filter(s => previous.sources?.some(p => p.file === s.file)).map(s => ({
  ...s, previous: previous.sources.find(p => p.file === s.file).sha256,
  unchanged: previous.sources.find(p => p.file === s.file).sha256 === s.sha256,
}));
const universes = process.argv.includes('--quick') ? ['padrao'] : ['padrao', 'abundante', 'energetico', 'congelado', 'ancestral'];
const results = [], claims = [], summary = [];
for (const universe of universes) for (const strategy of ['baseline', 'farm']) {
  let instance = 0;
  const configure = H => {
    const { E, DATA: D } = H, engineInstance = ++instance;
    const histories = new WeakMap(), seen = new WeakMap();
    const totalDataProduced = S => D.regionOrder.reduce((sum, rid) => sum + (S.run.regions[rid].stats.data || 0), 0);
    const tick = E.tick;
    E.tick = function (S, seconds, ...args) {
      const start = S.run.time, before = totalDataProduced(S);
      const out = tick(S, seconds, ...args);
      let h = histories.get(S);
      if (!h || h.universe !== S.run.universe || S.run.time < h.time) {
        h = { universe: S.run.universe, time: S.run.time, samples: [] }; histories.set(S, h);
      }
      h.time = S.run.time; h.samples.push({ start, end: S.run.time, data: totalDataProduced(S) - before });
      while (h.samples.length && h.samples[0].end <= S.run.time - 300) h.samples.shift();
      return out;
    };
    const active = E.activeMissions;
    E.activeMissions = function (S, rid) {
      const out = active(S, rid);
      let first = seen.get(S);
      if (!first || first.run !== S.run) { first = { run: S.run, missions: {} }; seen.set(S, first); }
      for (const x of out) if (!first.missions[x.id]) first.missions[x.id] = {
        time: S.run.time, done: E.mProg(S, rid, x.md, x.id).done,
      };
      return out;
    };
    const claim = E.claim;
    E.claim = function (S, rid, id, ...rest) {
      const x = active(S, rid).find(m => m.id === id);
      const h = histories.get(S), samples = h?.samples || [];
      const span = samples.length ? S.run.time - samples[0].start : 0;
      const production = span > 0 ? samples.reduce((s, p) => s + p.data, 0) / span : 0;
      const first = seen.get(S)?.missions[id];
      const out = claim(S, rid, id, ...rest);
      if (out.ok && x) claims.push({ initialUniverse: universe, strategy, engineInstance,
        collapseCount: S.perm.collapses, universe: S.run.universe, time: S.run.time, id, region: rid,
        title: E.mTitle(x.md), type: x.md.t, reward: x.md.rw, received: out.got,
        firstActiveTime: first?.time ?? null, alreadyDoneAtFirstSeen: first?.done ?? null,
        precedingProductionWindowSeconds: span, precedingProductionDataPerSecond: round(production),
        dataRewardEquivalentSeconds: production > 0 ? round(out.got.data / production) : null,
      });
      return out;
    };
  };
  const { result } = runScenario(universe, strategy, { label: 'verificacao-2026-10-29', configure });
  results.push(result);
  const campaignClaims = claims.filter(c => c.initialUniverse === universe && c.strategy === strategy && c.engineInstance === 1);
  const row = { universe, strategy, cycles: result.cycles.map(c => {
    const cs = campaignClaims.filter(m => m.collapseCount === c.cycle - 1);
    const paid = cs.filter(m => m.received.data > 0 && m.dataRewardEquivalentSeconds !== null);
    const values = paid.map(m => m.dataRewardEquivalentSeconds).sort((a, b) => a - b);
    const at = p => values.length ? values[Math.floor((values.length - 1) * p)] : null;
    return { cycle: c.cycle, universe: c.universe, collapseReady: c.collapseReady,
      minutes: round(c.time / 60), researchPercent: c.researchPercent, data: c.data,
      missions: c.missions, grossData: c.grossData, missionData: c.income.mission || 0,
      missionIncomePercent: round(100 * (c.income.mission || 0) / c.grossData),
      missionDataEquivalentMedianSeconds: at(0.5), missionDataEquivalentP90Seconds: at(0.9),
      measuredDataMissions: values.length, missionsAlreadyDoneOnAppearance: cs.filter(m => m.alreadyDoneAtFirstSeen).length,
      reconciliationError: c.reconciliationError,
    };
  }), firstPlus4h: { percent: result.firstUniverseExtended?.end.researchPercent, data: result.firstUniverseExtended?.end.data,
    research100Time: result.firstUniverseExtended?.milestones.research100 ?? null },
  secondPlus4h: { percent: result.extended.end.researchPercent, data: result.extended.end.data },
  };
  summary.push(row);
  console.log(JSON.stringify({ event: 'verification', ...row }));
}
const output = { generatedAt: new Date().toISOString(), sources, comparison,
  method: 'Motor atual sem alterações em VM, bot normal e farm nos cinco universos, duas campanhas e dois ramos de +4h; --quick limita ao Padrão. Recompensa equivalente compara com produção científica real nos 300s anteriores, não taxa teórica; no início usa janela disponível. São decisões ativas a cada 2s, não previsão de tempo humano.',
  summary, results,
};
fs.mkdirSync(path.join(ROOT, 'artifacts'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'artifacts/verificacao-campanhas.json'), JSON.stringify(output, null, 2));
fs.writeFileSync(path.join(ROOT, 'artifacts/verificacao-missoes-campanhas.json'), JSON.stringify({ generatedAt: output.generatedAt, sources, method: output.method, claims }, null, 2));
console.log('Verificação salva em artifacts/verificacao-campanhas.json e artifacts/verificacao-missoes-campanhas.json');
