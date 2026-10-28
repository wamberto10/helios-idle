/* Perfil local do comandante: validação, compatibilidade e persistência.
   Uso: node tools/profile-test.js. Estados em memória; não acessa partidas do navegador. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert/strict');
const context = { console, Buffer, Date, setTimeout, clearTimeout }; context.globalThis = context;
vm.createContext(context);
for (const file of ['data.js', 'engine.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', file), 'utf8'), context, { filename: file });
const { DATA: D, E } = context.H;
const plain = value => JSON.parse(JSON.stringify(value));
let checks = 0;
const check = (condition, message) => { checks++; assert.ok(condition, message); };
const equal = (actual, expected, message) => { checks++; assert.deepEqual(plain(actual), plain(expected), message); };

const state = E.newState();
check(state.profile === null, 'partida nova começa sem perfil');
equal(Object.keys(D.commanderAvatars), ['aurora', 'atlas', 'sentinela', 'eclipse'], 'avatares pertencem a uma lista explícita');
const progression = JSON.stringify({ perm: state.perm, run: state.run, settings: state.settings });
const submitted = { name: '  Joa\u0303o \u00a0 da  Lua  ', avatar: 'atlas', password: 'não deve ser armazenada' };
const created = E.setProfile(state, submitted);
check(created.ok, 'perfil válido é criado');
equal(state.profile, { name: 'João da Lua', avatar: 'atlas' }, 'NFC e espaços são normalizados e campos extras descartados');
check(JSON.stringify({ perm: state.perm, run: state.run, settings: state.settings }) === progression, 'criar perfil não altera recursos, missões, especialistas ou configurações');
submitted.name = 'Outro';
check(state.profile.name === 'João da Lua', 'perfil não mantém referência ao objeto recebido');

const invalid = [
  null, undefined, [], 'João', {}, { name: 42, avatar: 'atlas' },
  { name: ' ', avatar: 'atlas' }, { name: 'A', avatar: 'atlas' }, { name: 'a'.repeat(25), avatar: 'atlas' },
  { name: '<img src=x onerror=alert(1)>', avatar: 'atlas' }, { name: 'Comandante\u0000', avatar: 'atlas' },
  { name: 'Comandante\nTeste', avatar: 'atlas' }, { name: 'Comandante\u202E', avatar: 'atlas' },
  { name: 'Comandante\u200B', avatar: 'atlas' }, { name: 'A\ud800B', avatar: 'atlas' },
  { name: 'Comandante', avatar: '../portraits/iris.png' }, { name: 'Comandante', avatar: '__proto__' },
  { name: 'Comandante', avatar: 'constructor' }, { name: 'Comandante', avatar: 'toString' },
  { name: 'Comandante', avatar: {} }, Object.create({ name: 'Herdado', avatar: 'atlas' }),
  { get name() { throw new Error('getter'); }, avatar: 'atlas' },
];
const beforeInvalid = JSON.stringify(state);
for (let i = 0; i < invalid.length; i++) {
  const result = E.setProfile(state, invalid[i]);
  check(!result.ok && typeof result.err === 'string' && result.err.length > 10, 'entrada inválida ' + i + ' retorna erro legível');
  check(JSON.stringify(state) === beforeInvalid, 'entrada inválida ' + i + ' não altera a partida nem o perfil anterior');
}
for (const avatar of Object.keys(D.commanderAvatars)) check(E.validateProfile({ name: 'Astra 🚀', avatar }).ok, 'avatar ' + avatar + ' e nome Unicode aceitos');
check(E.validateProfile({ name: '🚀'.repeat(24), avatar: 'aurora' }).ok, 'limite conta caracteres Unicode completos');
check(!E.validateProfile({ name: '🚀'.repeat(25), avatar: 'aurora' }).ok, '25 caracteres Unicode são rejeitados');

// Um salvamento anterior à criação de perfis é carregado sem zerar o progresso.
state.perm.data = 527; state.run.regions.lua.phase = 2; state.run.regions.lua.st.ore = 74; state.settings.sound = false;
const saved = plain(JSON.parse(E.serialize(state))); delete saved.profile;
for (const version of [1, D.SAVE_VERSION]) {
  const old = plain(saved); old.v = version;
  const loaded = E.deserialize(JSON.stringify(old));
  check(loaded.ok, 'salvamento antigo v' + version + ' carrega');
  check(loaded.S.profile === null, 'salvamento antigo v' + version + ' fica aguardando criação de perfil');
  check(loaded.S.perm.data === 527 && loaded.S.run.regions.lua.phase === 2 && loaded.S.run.regions.lua.st.ore === 74 && !loaded.S.settings.sound, 'progresso v' + version + ' preservado');
}
const exported = E.exportStr(state); const imported = E.importStr(exported);
check(imported.ok, 'exportação com perfil importa');
equal(imported.S.profile, state.profile, 'exportar e importar preserva identidade');
check(imported.S.perm.data === 527 && imported.S.run.regions.lua.phase === 2, 'exportar perfil preserva progresso');
const raw = JSON.parse(E.serialize(state)); raw.profile = { name: '  Astra  Lua  ', avatar: 'aurora', admin: true };
const normalizedImport = E.deserialize(JSON.stringify(raw));
check(normalizedImport.ok, 'importação normaliza perfil válido');
equal(normalizedImport.S.profile, { name: 'Astra Lua', avatar: 'aurora' }, 'importação permite somente nome e avatar validados');
for (const profile of [{}, 'alguém', { name: 'X', avatar: 'atlas' }, { name: '<b>Lua</b>', avatar: 'atlas' }, { name: 'Lua', avatar: '__proto__' }]) {
  const corrupted = plain(raw); corrupted.profile = profile;
  check(!E.deserialize(JSON.stringify(corrupted)).ok, 'perfil inválido no código de importação é rejeitado');
}
check(Object.getPrototypeOf(state.profile) !== null && !Object.prototype.admin, 'campos extras não modificam protótipos globais');

// A identidade acompanha o jogador ao atravessar a singularidade.
for (const rid of D.regionOrder) {
  if (!state.run.regions[rid].unlocked) E.unlockRegion(state, rid);
  state.run.regions[rid].phase = D.regions[rid].phases.length;
}
state.run.dyson.stage = D.dysonRequired; state.run.core = true; state.events = [];
const profileBeforeCollapse = plain(state.profile), oldRun = state.run;
const collapse = E.doCollapse(state, E.collapseOffer(state)[0]);
check(collapse.ok && state.run !== oldRun, 'Colapso de verificação cria outro universo');
equal(state.profile, profileBeforeCollapse, 'Colapso preserva nome e avatar');
equal(E.importStr(E.exportStr(state)).S.profile, profileBeforeCollapse, 'identidade continua exportável depois do Colapso');
console.log('Perfil do comandante: ' + checks + ' verificações OK.');
