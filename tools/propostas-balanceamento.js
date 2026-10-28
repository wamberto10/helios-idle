/* Ensaios de propostas APENAS em memória; não altera data.js/engine.js nem partidas. */
'use strict';
const fs = require('fs'), path = require('path');
const { runScenario, load } = require('./simular-campanhas');
const SCIENCE_SPEED = [1, 2, 2.5, 3, 4, 5, 6, 7.5, 9, 10.5, 12];
const COST_SCALE_BY_ROW = [1, 1, 2, 4, 8];
function configureScience(H) {
  const { E, DATA: D } = H;
  const originalMods = E.mods, originalSpeed = E.speedOf, originalYield = E.yieldOf;
  E.mods = function (S) { const m = originalMods(S); m.auditScienceSpeed = SCIENCE_SPEED[S.perm.specs.oraculo?.lvl || 0]; return m; };
  E.speedOf = (def, m) => def.out?.data ? m.auditScienceSpeed * Math.sqrt(m.globalSpeed) : originalSpeed(def, m);
  E.yieldOf = (def, bs, resource, m) => resource === 'data'
    ? originalYield(def, bs, resource, m) / m.globalYield * (1 + 0.2 * (bs.lvl - 1)) / D.levelYield(bs.lvl)
    : originalYield(def, bs, resource, m);
}
function configureCosts(H) {
  const { DATA: D } = H;
  for (const node of Object.values(D.research)) {
    if (node.cur === 'frag') continue;
    const nodes = Object.values(D.research).filter(n => n.br === node.br), row = nodes.indexOf(node);
    node.cost *= COST_SCALE_BY_ROW[row];
  }
}
function configureGradual(H) {
  const { E, DATA: D } = H, mods = E.mods, speed = E.speedOf, yieldOf = E.yieldOf;
  const curve = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12];
  E.mods = S => { const m = mods(S); m.auditScienceSpeed = curve[S.perm.specs.oraculo?.lvl || 0]; return m; };
  E.speedOf = (def, m) => def.out?.data ? m.auditScienceSpeed * Math.sqrt(m.globalSpeed) : speed(def, m);
  E.yieldOf = (def, bs, resource, m) => yieldOf(def, bs, resource, m) / (resource === 'data' ? m.globalYield : 1);
  for (const node of Object.values(D.research)) if (node.cur !== 'frag') node.cg = Math.max(node.cg, node.max > 3 ? 2.8 : 3);
}
const variants = {
  ciencia: configureScience,
  custos: configureCosts,
  combinado: H => { configureScience(H); configureCosts(H); },
  gradual: configureGradual,
};
if (require.main === module) {
  const selected = process.argv[2] && variants[process.argv[2]] ? [process.argv[2]] : Object.keys(variants);
  const strategy = process.argv[3] || 'farm';
  const universes = process.argv[4] === 'all' ? ['padrao', 'abundante', 'energetico', 'congelado', 'ancestral'] : [process.argv[4] || 'padrao'];
  const campaignOnly = process.argv.includes('--campaign-only');
  const results = [];
  for (const variant of selected) for (const universe of universes) {
    const { result, states } = runScenario(universe, strategy, { label: variant, configure: variants[variant], cycles: campaignOnly ? 1 : 2, maxH: 6, extensionSec: campaignOnly ? 0 : 14400 });
    if (result.cycles.some(c => !c.collapseReady)) {
      const ctx = load(); variants[variant](ctx.H); const { E, DATA: D } = ctx.H;
      result.stalled = states.filter((_, i) => !result.cycles[i].collapseReady).map(raw => {
        const S = E.deserialize(JSON.stringify(raw)).S;
        return { regions: D.regionOrder.filter(rid => S.run.regions[rid].unlocked && !E.regionDone(S, rid)).map(rid => ({ rid, phase: S.run.regions[rid].phase, missions: E.activeMissions(S, rid).map(x => ({ title: E.mTitle(x.md), progress: E.mProg(S, rid, x.md, x.id) })), stock: S.run.regions[rid].st, buildings: S.run.regions[rid].b, energy: S.run.regions[rid].en })), routes: S.run.routes };
      });
    }
    results.push(result);
    const target = path.join(__dirname, '../artifacts/proposta-' + variant + '-' + strategy + (universe !== 'padrao' ? '-' + universe : '') + (campaignOnly ? '-campanha' : '') + '.json');
    fs.writeFileSync(target, JSON.stringify({ hypothesisOnly: true, scienceSpeed: SCIENCE_SPEED, scienceYieldPerLevel: 0.2, costsByRow: COST_SCALE_BY_ROW, result }, null, 2));
    console.log(JSON.stringify({ variant, strategy, cycles: result.cycles.map(c => ({ ready: c.collapseReady, minutes: c.time / 60, researchPercent: c.researchPercent, data: c.data })), firstPlus4h: { researchPercent: result.firstUniverseExtended?.end.researchPercent, data: result.firstUniverseExtended?.end.data }, secondPlus4h: { researchPercent: result.extended.end.researchPercent, data: result.extended.end.data }, output: target }));
  }
}
module.exports = { configureScience, configureCosts, configureGradual };
