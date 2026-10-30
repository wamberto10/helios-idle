/* HELIOS IDLE — imagens do manifesto e arte de reserva em SVG. */
(function (H) {
  'use strict';
  const D = H.DATA;
  const A = H.A = {};
  let uid = 0;
  const id = (p) => p + (++uid);

  const failedImages = new Set();
  const assetPath = (kind, key) => {
    const group = (H.ASSET_MANIFEST || {})[kind];
    return group && Object.prototype.hasOwnProperty.call(group, key) && typeof group[key] === 'string' ? group[key] : '';
  };
  A.paths = {};
  for (const kind of ['portrait', 'commander', 'building', 'region', 'terrain', 'planet', 'ui', 'resource']) A.paths[kind] = (key) => assetPath(kind, key);
  A.imageLoaded = function (img) {
    if (img.naturalWidth && img.parentElement) img.parentElement.classList.add('has-image');
  };
  A.imageFailed = function (img) {
    failedImages.add(img.getAttribute('src'));
    if (img.parentElement) img.parentElement.classList.remove('has-image');
    img.remove();
  };
  // O SVG mantém o tamanho e fica visível até a imagem terminar de carregar.
  // Arquivos não declarados ou já ausentes nesta sessão não geram novas solicitações.
  A.img = function (src, fallback, cls) {
    const kind = fallback.includes('class="chest-svg ') ? 'art-chest' : '';
    const image = src && !failedImages.has(src) ? `<img src="${src.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}" alt="" loading="lazy" decoding="async" onload="H.A.imageLoaded(this)" onerror="H.A.imageFailed(this)">` : '';
    return `<span class="art ${kind} ${cls || ''}">${fallback}${image}</span>`;
  };

  // ---------------- RETRATOS ----------------
  function hash(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }
  A.portrait = function (sid, locked) {
    const sp = D.specs[sid]; const c = sp.color; const g = id('pg'); const h = hash(sid);
    const bg = `<defs><radialGradient id="${g}" cx="50%" cy="35%" r="75%"><stop offset="0" stop-color="${c}" stop-opacity=".55"/><stop offset=".6" stop-color="#0b1630"/><stop offset="1" stop-color="#050a18"/></radialGradient></defs>
      <rect width="120" height="150" fill="url(#${g})"/>`;
    let body = '';
    if (locked) {
      body = `<circle cx="60" cy="62" r="26" fill="#0e1a36" stroke="#2a3f6a" stroke-width="2"/><path d="M20 150c4-34 22-48 40-48s36 14 40 48z" fill="#0e1a36" stroke="#2a3f6a" stroke-width="2"/><text x="60" y="72" text-anchor="middle" font-size="30" fill="#5d7299" font-weight="700">?</text>`;
    } else if (sp.kind.startsWith('Human')) {
      const hair = ['#2b1d14', '#d9b26a', '#e8eef7', '#6b2a1e', '#1c2440'][h % 5];
      const skin = ['#e7c3a1', '#c58e64', '#8d5a3b', '#f1d4bc'][h % 4];
      body = `<path d="M14 150c4-36 24-52 46-52s42 16 46 52z" fill="#1b2a4a"/><path d="M30 150c3-24 14-36 30-36s27 12 30 36z" fill="${c}" opacity=".35"/>
        <path d="M44 104l16 10 16-10" stroke="${c}" stroke-width="3" fill="none"/>
        <circle cx="60" cy="62" r="30" fill="#c8d6ef" opacity=".14" stroke="${c}" stroke-width="2"/>
        <ellipse cx="60" cy="64" rx="18" ry="22" fill="${skin}"/>
        <path d="M41 60c0-16 9-24 19-24s20 8 20 24c-4-7-10-11-20-11s-15 4-19 11z" fill="${hair}"/>
        ${h % 2 ? `<path d="M40 62c-3 14 0 26 4 30" stroke="${hair}" stroke-width="6" fill="none" stroke-linecap="round"/>` : ''}
        <circle cx="53" cy="66" r="2.2" fill="#14203a"/><circle cx="67" cy="66" r="2.2" fill="#14203a"/>
        <path d="M54 76q6 4 12 0" stroke="#7a3a30" stroke-width="2" fill="none" stroke-linecap="round"/>
        <path d="M36 50a26 26 0 0 1 48 0" stroke="${c}" stroke-width="3" fill="none" opacity=".8"/>`;
    } else if (sp.kind === 'Robô') {
      body = `<path d="M18 150l8-40h68l8 40z" fill="#26324f" stroke="${c}" stroke-opacity=".6"/>
        <rect x="52" y="96" width="16" height="14" fill="#3a4766"/>
        <rect x="34" y="40" width="52" height="56" rx="10" fill="#4a5878" stroke="${c}" stroke-width="2"/>
        <rect x="40" y="56" width="40" height="16" rx="8" fill="#0b1226"/>
        <circle cx="50" cy="64" r="5" fill="${c}"/><circle cx="70" cy="64" r="5" fill="${c}"/>
        <rect x="46" y="80" width="28" height="6" rx="3" fill="#2a3552"/><path d="M60 40V26" stroke="#8aa0c8" stroke-width="3"/><circle cx="60" cy="24" r="4" fill="${c}"/>
        <rect x="28" y="58" width="6" height="16" rx="2" fill="#3a4766"/><rect x="86" y="58" width="6" height="16" rx="2" fill="#3a4766"/>`;
    } else if (sp.kind === 'IA') {
      body = `<g transform="translate(60 70)"><circle r="40" fill="none" stroke="${c}" stroke-opacity=".25" stroke-width="1"/>
        <ellipse rx="40" ry="14" fill="none" stroke="${c}" stroke-width="2" transform="rotate(${h % 60 - 30})" opacity=".8"/>
        <ellipse rx="40" ry="14" fill="none" stroke="${c}" stroke-width="1.5" transform="rotate(${(h % 60) + 40})" opacity=".55"/>
        <circle r="18" fill="${c}" opacity=".25"/><circle r="11" fill="${c}"/><circle r="5" fill="#fff" opacity=".9"/>
        <path d="M-6-30l6-6 6 6M-6 30l6 6 6-6" stroke="${c}" stroke-width="2" fill="none"/></g>`;
    } else {
      body = `<g transform="translate(60 70)"><circle r="34" fill="#000"/><circle r="36" fill="none" stroke="${c}" stroke-width="3"/>
        <circle r="44" fill="none" stroke="${c}" stroke-opacity=".3" stroke-dasharray="3 6"/><path d="M-30 0a30 10 0 0 0 60 0" stroke="#fff" stroke-opacity=".5" fill="none"/>
        <circle cx="-8" cy="-6" r="2" fill="#fff"/><circle cx="12" cy="4" r="1.5" fill="#fff"/></g>`;
    }
    return `<svg viewBox="0 0 120 150" class="portrait-svg" aria-hidden="true">${bg}${body}</svg>`;
  };
  A.portraitBox = (sid, locked, cls) => locked ? `<span class="art ${cls || ''}">${A.portrait(sid, true)}</span>` : A.img(A.paths.portrait(sid), A.portrait(sid), cls);

  // O jogador tem sua própria identidade; os especialistas continuam na tripulação.
  A.commanderAvatar = function (avatar, cls) {
    const key = Object.prototype.hasOwnProperty.call(D.commanderAvatars, avatar) ? avatar : 'aurora';
    const c = D.commanderAvatars[key].color, g = id('commander-g');
    const fallback = `<svg viewBox="0 0 120 150" aria-hidden="true"><defs><radialGradient id="${g}"><stop stop-color="${c}" stop-opacity=".35"/><stop offset="1" stop-color="#071126"/></radialGradient></defs><rect width="120" height="150" fill="url(#${g})"/><path d="M17 150l8-33 22-12h26l22 12 8 33" fill="#cbd7df" stroke="${c}" stroke-width="2"/><path d="M47 105v24h26v-24" fill="#1b2a44"/><circle cx="60" cy="64" r="34" fill="#dbe4e8" stroke="${c}" stroke-width="2"/><rect x="34" y="44" width="52" height="38" rx="17" fill="#101e37"/><path d="M42 55h36" stroke="${c}" stroke-width="3" opacity=".8"/><path d="M37 88l10 7h26l10-7" fill="none" stroke="#243a55" stroke-width="5"/></svg>`;
    return A.img(A.paths.commander(key), fallback, 'commander-avatar ' + (cls || ''));
  };

  // ---------------- ÍCONES DE INSTALAÇÕES ----------------
  const BI = {
    painel: (c) => `<path d="M8 30l14-18h22L30 30z" fill="#1e3a6e" stroke="${c}" stroke-width="2"/><path d="M15 21h22M19 16l-8 10M26 12l-8 18M33 12l-8 18" stroke="${c}" stroke-opacity=".6"/><path d="M24 30v10M16 40h16" stroke="#8aa0c8" stroke-width="3"/>`,
    coletor_solar: (c) => `<path d="M6 30a18 18 0 0 1 36 0z" fill="#2a3b66" stroke="${c}" stroke-width="2"/><path d="M24 30L36 10" stroke="${c}" stroke-width="2"/><circle cx="36" cy="9" r="4" fill="#ffd76a"/><path d="M24 30v10M14 42h20" stroke="#8aa0c8" stroke-width="3"/>`,
    reator: (c) => `<ellipse cx="24" cy="26" rx="18" ry="9" fill="none" stroke="${c}" stroke-width="4"/><circle cx="24" cy="26" r="6" fill="${c}"/><circle cx="24" cy="26" r="3" fill="#fff"/><path d="M10 40h28" stroke="#8aa0c8" stroke-width="3"/>`,
    armazem: (c) => `<rect x="6" y="24" width="16" height="16" fill="#3a4766" stroke="${c}"/><rect x="24" y="24" width="16" height="16" fill="#3a4766" stroke="${c}"/><rect x="15" y="8" width="16" height="16" fill="#4a5878" stroke="${c}"/><path d="M6 32h16M24 32h16M15 16h16" stroke="${c}" stroke-opacity=".5"/>`,
    extrator: (c) => `<path d="M18 8h12l4 26H14z" fill="#3a4766" stroke="${c}" stroke-width="2"/><path d="M24 34v8" stroke="${c}" stroke-width="4"/><path d="M20 42l4 4 4-4" fill="${c}"/><path d="M8 44h32" stroke="#8a7a66" stroke-width="3"/><circle cx="24" cy="14" r="2" fill="#ffd76a"/>`,
    min_ast: (c) => `<path d="M30 10l10 6-2 12-10 4-8-8z" fill="#7a6a5a" stroke="#b9a48a"/><path d="M6 36l10-10 6 4M16 26l-2-8" stroke="${c}" stroke-width="3" fill="none"/><rect x="2" y="34" width="14" height="8" rx="2" fill="#3a4766" stroke="${c}"/>`,
    garimpo: (c) => `<path d="M8 38l8-20 14-6 10 14-6 14z" fill="#5a4d42" stroke="#b9a48a"/><path d="M20 24l4 8 6-6z" fill="#d58cff"/><path d="M28 32l2 4 4-3z" fill="#d58cff"/><circle cx="38" cy="10" r="3" fill="${c}"/>`,
    esc_gelo: (c) => `<rect x="24" y="24" width="16" height="16" fill="#a8e6ff" opacity=".7" stroke="#e6f7ff"/><path d="M6 40V26h12l6-10" stroke="${c}" stroke-width="3" fill="none"/><path d="M22 14l6 2-2 6" fill="${c}"/><circle cx="10" cy="42" r="3" fill="#3a4766"/><circle cx="18" cy="42" r="3" fill="#3a4766"/>`,
    plataforma: (c) => `<ellipse cx="24" cy="14" rx="14" ry="9" fill="#e6d27a" opacity=".8" stroke="${c}"/><path d="M14 20l-4 12M34 20l4 12M24 23v9" stroke="#8aa0c8"/><rect x="8" y="32" width="32" height="6" rx="3" fill="#3a4766" stroke="${c}"/>`,
    refinaria: (c) => `<rect x="8" y="20" width="22" height="22" fill="#3a4766" stroke="${c}" stroke-width="2"/><rect x="32" y="8" width="7" height="34" fill="#4a5878" stroke="${c}"/><path d="M14 30h10" stroke="#ff8f5a" stroke-width="4"/><circle cx="35" cy="5" r="3" fill="#8aa0c8" opacity=".6"/>`,
    eletrolisador: (c) => `<rect x="10" y="10" width="28" height="30" rx="8" fill="#2a3b66" stroke="${c}" stroke-width="2"/><path d="M18 18v12M30 18v12" stroke="${c}" stroke-width="3"/><path d="M24 30c-3 4-3 7 0 7s3-3 0-7z" fill="#ff8f5a"/>`,
    quimica: (c) => `<path d="M14 8h8v10l8 18H6l8-18z" fill="#3a4766" stroke="${c}" stroke-width="2"/><path d="M28 14h10v8l6 16H24" fill="#2a3b66" stroke="${c}"/><path d="M9 32h18" stroke="#ff8f5a" stroke-width="3"/>`,
    forja: (c) => `<path d="M8 26h28l-4 6H12z" fill="#4a5878" stroke="${c}" stroke-width="2"/><rect x="18" y="32" width="8" height="10" fill="#3a4766"/><path d="M30 8l8 8-12 6-4-4z" fill="#8aa0c8" stroke="${c}"/><circle cx="12" cy="22" r="3" fill="#ff8f5a"/>`,
    fotovoltaica: (c) => `<rect x="6" y="16" width="26" height="26" fill="#1e3a6e" stroke="${c}" stroke-width="2"/><path d="M6 25h26M6 33h26M15 16v26M24 16v26" stroke="${c}" stroke-opacity=".5"/><circle cx="38" cy="10" r="6" fill="#ffd76a"/>`,
    ref_fusao: (c) => `<circle cx="24" cy="24" r="12" fill="#2a1b3a" stroke="${c}" stroke-width="2"/><ellipse cx="24" cy="24" rx="20" ry="6" fill="none" stroke="${c}" stroke-width="2" transform="rotate(-20 24 24)"/><circle cx="24" cy="24" r="4" fill="${c}"/>`,
    fabrica: (c) => `<path d="M6 42V22l10 6v-6l10 6v-6l10 6v14z" fill="#3a4766" stroke="${c}" stroke-width="2"/><circle cx="34" cy="12" r="7" fill="none" stroke="${c}" stroke-width="3" stroke-dasharray="3 2"/><rect x="12" y="34" width="6" height="8" fill="#7fe0c0"/>`,
    criogenico: (c) => `<rect x="8" y="8" width="32" height="34" rx="6" fill="#123048" stroke="${c}" stroke-width="2"/><path d="M24 14v22M14 20l20 10M34 20L14 30" stroke="#6ff0ff" stroke-width="2"/>`,
    fab_sat: (c) => `<rect x="18" y="18" width="12" height="12" fill="#ffd76a" stroke="${c}"/><rect x="2" y="20" width="14" height="8" fill="#1e3a6e" stroke="${c}"/><rect x="32" y="20" width="14" height="8" fill="#1e3a6e" stroke="${c}"/><path d="M24 30v10M16 42h16" stroke="#8aa0c8" stroke-width="3"/>`,
    estaleiro: (c) => `<path d="M6 34h30l6-8H12z" fill="#4a5878" stroke="${c}" stroke-width="2"/><path d="M14 26V8h20" stroke="#8aa0c8" stroke-width="3" fill="none"/><path d="M30 8v8" stroke="${c}" stroke-width="2"/><path d="M6 40h36" stroke="${c}" stroke-opacity=".5"/>`,
    observatorio: (c) => `<path d="M8 40V28a16 16 0 0 1 32 0v12z" fill="#3a4766" stroke="${c}" stroke-width="2"/><path d="M24 24l12-14" stroke="${c}" stroke-width="5"/><circle cx="38" cy="8" r="2" fill="#fff"/>`,
    obs_profundo: (c) => `<path d="M8 22a16 16 0 0 0 32 0z" fill="#2a3b66" stroke="${c}" stroke-width="2"/><path d="M24 22L24 6" stroke="${c}" stroke-width="2"/><circle cx="24" cy="6" r="3" fill="${c}"/><path d="M24 38v4M14 44h20" stroke="#8aa0c8" stroke-width="3"/>`,
    lab_anomalia: (c) => `<path d="M24 4l17 10v20L24 44 7 34V14z" fill="#1d1236" stroke="${c}" stroke-width="2"/><circle cx="24" cy="24" r="8" fill="#b07cff"/><circle cx="24" cy="24" r="3" fill="#000"/>`,
  };
  const CATC = { extract: '#b9a48a', industry: '#e0a35a', ice: '#a8e6ff', gas: '#e6d27a', solar: '#ffd76a', fusion: '#ff5ad1', research: '#b07cff', power: '#3fe0ff', storage: '#5ef2a0' };
  A.catColor = (cat) => CATC[cat] || '#3fe0ff';
  A.bIconSvg = (bid) => `<svg viewBox="0 0 48 48" aria-hidden="true">${(BI[bid] || BI.armazem)(A.catColor(D.buildings[bid].cat))}</svg>`;
  A.bIcon = (bid, cls) => A.img(A.paths.building(bid), A.bIconSvg(bid), 'bicon ' + (cls || ''));

  // ---------------- GLIFOS DE RECURSOS ----------------
  const RG = {
    ore: '<path d="M3 11l3-6 5-1 3 5-2 5H5z"/>',
    metal: '<path d="M2 11l3-5h8l-3 5z"/><path d="M2 11h8v2H2z" opacity=".7"/>',
    alloy: '<path d="M1 9l2-4h6l-2 4z"/><path d="M7 13l2-4h6l-2 4z"/>',
    comp: '<rect x="4" y="4" width="8" height="8" rx="1"/><path d="M2 6h2M2 10h2M12 6h2M12 10h2M6 2v2M10 2v2M6 12v2M10 12v2" stroke="currentColor" stroke-width="1.2"/>',
    ice: '<path d="M8 1l6 3.5v7L8 15l-6-3.5v-7z" opacity=".85"/>',
    gas: '<path d="M4 12a3 3 0 0 1 0-6 4 4 0 0 1 8 0 3 3 0 0 1 0 6z"/>',
    fuel: '<path d="M8 1c-3 5-5 7-5 10a5 5 0 0 0 10 0c0-3-2-5-5-10z"/>',
    rare: '<path d="M8 1l6 6-6 8-6-8z"/>',
    cell: '<rect x="2" y="2" width="12" height="12"/><path d="M2 8h12M8 2v12" stroke="#050a18" stroke-width="1.2"/>',
    fusion: '<circle cx="8" cy="8" r="2.5"/><ellipse cx="8" cy="8" rx="7" ry="2.6" fill="none" stroke="currentColor" stroke-width="1.3"/><ellipse cx="8" cy="8" rx="7" ry="2.6" fill="none" stroke="currentColor" stroke-width="1.3" transform="rotate(60 8 8)"/>',
    hull: '<path d="M8 1l6 3.5v7L8 15l-6-3.5v-7z" fill="none" stroke="currentColor" stroke-width="2"/>',
    cryo: '<path d="M8 1v14M2 4.5l12 7M14 4.5l-12 7" stroke="currentColor" stroke-width="2"/>',
    exotic: '<path d="M8 8m-6 0a6 6 0 1 0 6-6M8 8a3 3 0 1 1 3 3" fill="none" stroke="currentColor" stroke-width="2"/>',
    sat: '<rect x="6" y="6" width="4" height="4"/><rect x="1" y="7" width="4" height="2"/><rect x="11" y="7" width="4" height="2"/>',
    data: '<path d="M2 14V9h3v5zM6.5 14V5h3v9zM11 14V2h3v12z"/>',
    frag: '<path d="M8 1l4 6-4 8-4-8z"/><path d="M8 1v14" stroke="#050a18" stroke-width=".8"/>',
    energy: '<path d="M9 1L3 9h4l-1 6 6-8H8z"/>',
  };
  // Ícone de recurso. Por padrão anuncia o nome do recurso para leitores de tela (custos e receitas são só
  // ícone + número); deco = true quando o nome já está escrito ao lado, para não repetir.
  const RG_NAME = { data: 'dados de pesquisa', frag: 'fragmentos', energy: 'energia' };
  // Arte da prancha quando existe (custos com 24 px, estoque com 32 px); se o arquivo falhar, volta ao SVG.
  // Sem transição de opacidade: os custos são redesenhados quando os números mudam e não podem piscar.
  A.rgFailed = function (img) { failedImages.add(img.getAttribute('src')); const r = img.dataset.r; img.outerHTML = A.rg(r, +img.getAttribute('width'), img.getAttribute('aria-hidden') === 'true'); };
  A.rg = function (r, size, deco) {
    const color = r === 'data' ? '#3fe0ff' : r === 'frag' ? '#b07cff' : r === 'energy' ? '#ffd76a' : D.res[r].color;
    const name = RG_NAME[r] || (D.res[r] ? D.res[r].name : r);
    const src = A.paths.resource(r);
    if (src && !failedImages.has(src)) return `<img class="rg rgi" src="${src}" width="${size || 14}" height="${size || 14}" data-r="${r}" ${deco ? 'alt="" aria-hidden="true"' : `alt="${name}"`} decoding="async" draggable="false" onerror="H.A.rgFailed(this)">`;
    const a11y = deco ? 'aria-hidden="true"' : `role="img" aria-label="${name}"`;
    return `<svg class="rg" viewBox="0 0 16 16" width="${size || 14}" height="${size || 14}" style="color:${color}" fill="currentColor" focusable="false" ${a11y}>${RG[r] || RG.ore}</svg>`;
  };

  // ---------------- PLANETAS ----------------
  A.planetDefs = function () {
    let s = '<defs>';
    for (const rid of D.regionOrder) {
      const R = D.regions[rid];
      s += `<radialGradient id="pl-g-${rid}" cx="35%" cy="35%" r="75%"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".25" stop-color="${R.color}"/><stop offset="1" stop-color="${R.color2}"/></radialGradient>`;
    }
    s += `<radialGradient id="pl-g-terra" cx="35%" cy="35%" r="75%"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset=".3" stop-color="#3f8cff"/><stop offset="1" stop-color="#0d3070"/></radialGradient>`;
    s += `<radialGradient id="sun-g" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="var(--sun)"/><stop offset="1" stop-color="var(--sun)" stop-opacity="0"/></radialGradient>`;
    s += `<radialGradient id="sun-core" cx="40%" cy="40%" r="60%"><stop offset="0" stop-color="#fffbe6"/><stop offset="1" stop-color="var(--sun)"/></radialGradient>`;
    return s + '</defs>';
  };
  A.planetBody = function (rid, r) {
    const R = D.regions[rid] || {};
    let s = `<circle r="${r}" fill="url(#pl-g-${rid})"/>`;
    if (rid === 'jupiter') s += `<path d="M${-r} -${r * 0.3}h${2 * r}M${-r} ${r * 0.2}h${2 * r}" stroke="#8a5a3a" stroke-width="${r * 0.18}" opacity=".5"/><circle cx="${r * 0.35}" cy="${r * 0.35}" r="${r * 0.18}" fill="#b0603a" opacity=".8"/>`;
    if (rid === 'saturno') s += `<ellipse rx="${r * 2}" ry="${r * 0.55}" fill="none" stroke="#e6cf8f" stroke-width="${r * 0.25}" opacity=".75" transform="rotate(-18)"/>`;
    if (rid === 'urano') s += `<ellipse rx="${r * 1.6}" ry="${r * 0.3}" fill="none" stroke="#bfefff" stroke-width="1" opacity=".5" transform="rotate(80)"/>`;
    if (rid === 'marte') s += `<ellipse cx="0" cy="${-r * 0.82}" rx="${r * 0.4}" ry="${r * 0.15}" fill="#fff" opacity=".7"/>`;
    if (rid === 'venus') s += `<path d="M${-r * 0.8} 0q${r * 0.8} ${-r * 0.4} ${r * 1.6} 0" stroke="#fff" stroke-opacity=".35" fill="none" stroke-width="${r * 0.2}"/>`;
    if (rid === 'netuno') s += `<circle cx="${-r * 0.3}" cy="${r * 0.2}" r="${r * 0.18}" fill="#1b2f8a" opacity=".8"/>`;
    if (rid === 'lua') s += `<circle cx="${-r * 0.3}" cy="${-r * 0.2}" r="${r * 0.2}" fill="#6f7a90" opacity=".6"/><circle cx="${r * 0.35}" cy="${r * 0.3}" r="${r * 0.14}" fill="#6f7a90" opacity=".6"/>`;
    return s;
  };

  // ---------------- BASE: TERRENO LIMPO E UMA POSIÇÃO POR TIPO ----------------
  const BASE_ORDER = ['painel', 'extrator', 'min_ast', 'plataforma', 'refinaria', 'armazem', 'esc_gelo', 'eletrolisador', 'garimpo', 'forja', 'quimica', 'fabrica', 'coletor_solar', 'fotovoltaica', 'ref_fusao', 'criogenico', 'estaleiro', 'fab_sat', 'observatorio', 'obs_profundo', 'lab_anomalia', 'reator'];
  const baseLayouts = new Map();
  const htmlText = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  A.baseLayout = function (rid) {
    if (!baseLayouts.has(rid)) {
      // Usa TODOS os tipos previstos para a região, inclusive os ainda bloqueados.
      const buildings = Object.keys(D.regions[rid].build).sort((a, b) => BASE_ORDER.indexOf(a) - BASE_ORDER.indexOf(b));
      baseLayouts.set(rid, Object.freeze(buildings.map((bid, i) => Object.freeze({ bid, x: 18 + (i % 3) * 32, y: 136 + Math.floor(i / 3) * 166 }))));
    }
    return baseLayouts.get(rid);
  };
  A.terrain = function (rid) {
    const R = D.regions[rid]; const sky = id('base-sky'), ground = id('base-ground');
    const cold = ['urano', 'netuno', 'saturno'].includes(rid);
    return `<svg viewBox="0 0 1120 630" preserveAspectRatio="xMidYMin slice" class="terrain-svg" aria-hidden="true"><defs>
      <linearGradient id="${sky}" x2="0" y2="1"><stop stop-color="#050b1b"/><stop offset="1" stop-color="${R.color2}"/></linearGradient>
      <linearGradient id="${ground}" x2="0" y2="1"><stop stop-color="${R.color2}"/><stop offset="1" stop-color="${cold ? '#102b40' : '#172233'}"/></linearGradient></defs>
      <rect width="1120" height="630" fill="url(#${sky})"/>
      <path d="M0 126L100 105 220 121 350 91 470 119 620 98 760 123 910 103 1030 121 1120 110V630H0Z" fill="url(#${ground})"/>
      <path d="M0 220Q280 180 560 224T1120 215M0 450Q280 408 560 442T1120 430" stroke="${R.color}" stroke-opacity=".08" stroke-width="2" fill="none"/>
      <circle cx="124" cy="44" r="1.5" fill="#e8f0ff" opacity=".65"/><circle cx="420" cy="27" r="1" fill="#e8f0ff" opacity=".5"/><circle cx="760" cy="49" r="1.5" fill="#e8f0ff" opacity=".45"/>
    </svg>`;
  };
  A.scene = function (rid, reg, ctx) {
    const available = new Set(ctx && ctx.available || []);
    const slots = A.baseLayout(rid);
    const ground = A.img(A.paths.terrain(rid), A.terrain(rid), 'terrain-art');
    const roads = '<svg class="base-roads" viewBox="0 0 1120 630" preserveAspectRatio="none" aria-hidden="true"><path d="M202 234H918M202 400H918M202 566H918M202 234V566M560 234V566M918 234V566"/></svg>';
    return `<div class="base-scroll" data-region="${rid}" tabindex="0" role="region" aria-label="Terreno da base de ${htmlText(D.regions[rid].name)}. Use as setas para explorar os lados."><div class="base-ground"><div class="base-terrain">${ground}</div>${roads}<div class="base-slots">${slots.map(({ bid, x, y }) => {
      const bs = reg.b[bid] || { n: 0, lvl: 1 }; const def = D.buildings[bid]; const built = bs.n > 0; const show = built || available.has(bid);
      return `<button type="button" class="base-slot ${built ? 'is-built' : 'is-empty'}${show ? '' : ' is-locked'}" style="left:${x}%;top:${y}px;--building-color:${A.catColor(def.cat)}" data-a="base|${rid}|${bid}" data-u="baseslot|${rid}|${bid}" data-bid="${bid}" ${show ? '' : 'disabled'} aria-label="${htmlText(def.name)}. Abrir controles de produção"><span class="base-pad" aria-hidden="true"></span><span class="base-sprite" data-sprite="${built ? bid : ''}" aria-hidden="true">${built ? A.bIcon(bid) : ''}</span><span class="base-name">${htmlText(def.name)}</span><span class="base-meta"><span class="base-badge">${built ? 'Nv. ' + bs.lvl + ' · ×' + bs.n : '+ Construir'}</span><span class="base-mode"></span></span></button>`;
    }).join('')}</div></div></div>`;
  };

  A.chest = (open) => `<svg viewBox="0 0 120 100" class="chest-svg ${open ? 'open' : ''}" aria-hidden="true">
    <defs><linearGradient id="chg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd76a"/><stop offset="1" stop-color="#b8862a"/></linearGradient></defs>
    <rect x="16" y="44" width="88" height="48" rx="6" fill="#26324f" stroke="url(#chg)" stroke-width="4"/>
    <g class="lid"><path d="M14 46 Q60 10 106 46z" fill="#33405f" stroke="url(#chg)" stroke-width="4"/></g>
    <rect x="52" y="50" width="16" height="18" rx="3" fill="url(#chg)"/><path d="M16 70h88" stroke="#3fe0ff" stroke-opacity=".6" stroke-width="2"/></svg>`;

  // ícones da navegação
  const NAV = {
    map: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="20" cy="12" r="1.8"/>',
    region: '<path d="M3 18l5-7 4 4 3-3 6 6z"/><circle cx="17" cy="7" r="2.5"/>',
    crew: '<circle cx="9" cy="8" r="3.2"/><path d="M3 19c0-4 3-6 6-6s6 2 6 6z"/><circle cx="17" cy="9" r="2.5"/><path d="M15 19c0-3 1-5 3.5-5S22 16 22 19z"/>',
    research: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M7 16h10l1.5 3h-13z"/>',
    exp: '<path d="M12 2l3 7-3 3-3-3z"/><path d="M9 12l-3 3 1 3 3-2M15 12l3 3-1 3-3-2" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="20" r="1.6"/>',
    sing: '<circle cx="12" cy="12" r="3.5"/><path d="M12 3a9 9 0 0 1 9 9M12 21a9 9 0 0 1-9-9M3.5 7a9 9 0 0 1 5-3.5M20.5 17a9 9 0 0 1-5 3.5" fill="none" stroke="currentColor" stroke-width="1.8"/>',
    settings: '<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" stroke="currentColor" stroke-width="1.8"/>',
    chest: '<rect x="3" y="10" width="18" height="10" rx="1.5"/><path d="M3 10q9-8 18 0z" opacity=".75"/><rect x="10.5" y="11" width="3" height="4" fill="#050a18"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2"/>',
    check: '<path d="M4 12l5 5L20 6" fill="none" stroke="currentColor" stroke-width="2.6"/>',
    warn: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 17v1.5" stroke="#050a18" stroke-width="2"/>',
    play: '<path d="M7 4l13 8-13 8z"/>', up: '<path d="M12 3l8 9h-5v9H9v-9H4z"/>', pause: '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>',
    bolt: '<path d="M13 2L5 13h6l-1 9 8-11h-6z"/>', ship: '<path d="M22 12L4 6l4 6-4 6z"/>', sound: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 8a5 5 0 0 1 0 8" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  };
  A.ic = (n, size) => `<svg class="ic" viewBox="0 0 24 24" width="${size || 20}" height="${size || 20}" fill="currentColor" aria-hidden="true">${NAV[n] || ''}</svg>`;
})(window.H = window.H || {});
