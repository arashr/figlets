// doc-runner.js — Complete spec sheet pipeline in one script.
// Requires detect-ds-context.js pasted above (provides _allVars, _allTextStyles, varByName, DS_CONTEXT).
//
// Make exactly THREE substitutions before running:
//   1. Replace 'COMPONENT_NAME' with the actual component name (line below)
//   2. Replace _usageDo / _usageDont arrays with component-specific rules (~line 11)
//   3. Replace _variantDesc = {} with a map of exact variant name → ≤10-word purpose (~line 15)

const compName = 'COMPONENT_NAME';

// ── USAGE GUIDELINES (substitute with component-specific rules) ───────────────
const _usageDo   = ['Use for its intended primary action', 'Ensure touch target ≥ 44×44px'];
const _usageDont = ['Avoid overloading with too many variants in one view', 'Do not truncate critical label text'];

// ── VARIANT DESCRIPTIONS (substitute: map exact variant name → ≤10-word purpose) ──
const _variantDesc = {};

// ═══════════════════════════════════════════════════════════════════════════════
// PIPELINE — do not edit below this line
// ═══════════════════════════════════════════════════════════════════════════════

// ── FIND COMPONENT ────────────────────────────────────────────────────────────
const _comp = figma.currentPage.findOne(n =>
  (n.type === 'COMPONENT' || n.type === 'COMPONENT_SET') && n.name === compName);
if (!_comp) return `Component "${compName}" not found on the current page`;
const compSet = _comp;
const compMeta = {
  type: _comp.type,
  width: _comp.width,
  height: _comp.height,
  variantCount: _comp.type === 'COMPONENT_SET' ? _comp.children.length : 1,
  variants: _comp.type === 'COMPONENT_SET' ? _comp.children.map(c => c.name) : [_comp.name],
  componentPropertyDefinitions: _comp.componentPropertyDefinitions || {},
  description: _comp.description || ''
};

// ── READ BOUNDS ───────────────────────────────────────────────────────────────
const _defaultV = compSet.type === 'COMPONENT_SET'
  ? (compSet.children.find(c => c.name.includes('Default') || c.name.includes('Full')) || compSet.children[0])
  : compSet;
const _compBounds = _defaultV.absoluteBoundingBox;
const elements = [];
function _collectEl(node, depth) {
  if (depth === undefined) depth = 0;
  if (!node.absoluteBoundingBox) return;
  // Skip depth 0 (root component itself — its x:0,y:0 triggers negative badge placement)
  // Skip INSTANCE nodes — they share their parent FRAME's bounding box, causing duplicate badges
  if (depth > 0 && node.type !== 'INSTANCE') {
    const nb = node.absoluteBoundingBox;
    elements.push({ name: node.name, type: node.type, depth,
      x: Math.round(nb.x - _compBounds.x), y: Math.round(nb.y - _compBounds.y),
      w: Math.round(nb.width), h: Math.round(nb.height) });
  }
  if ('children' in node && node.type !== 'INSTANCE') node.children.forEach(c => _collectEl(c, depth + 1));
}
_collectEl(_defaultV);

// ── READ BINDINGS (sync — uses _allVars from detect-ds-context) ───────────────
function _collectBind(node, acc) {
  if (acc === undefined) acc = [];
  if (node.type === 'INSTANCE') return acc;
  const bv = node.boundVariables || {};
  for (const [key, label] of [
    ['fills','Fill'],['strokes','Stroke'],['paddingTop','paddingTop'],['paddingBottom','paddingBottom'],
    ['paddingLeft','paddingLeft'],['paddingRight','paddingRight'],['itemSpacing','itemSpacing'],
    ['counterAxisSpacing','counterAxisSpacing'],['fontSize','fontSize'],
    ['topLeftRadius','cornerRadius'],['strokeTopWeight','strokeWeight']
  ]) {
    if (bv[key]) {
      const e = Array.isArray(bv[key]) ? bv[key][0] : bv[key];
      if (e?.id) acc.push({ node: node.name, property: label, varId: e.id });
    }
  }
  if (node.type === 'TEXT' && node.textStyleId)
    acc.push({ node: node.name, property: 'textStyle', styleId: node.textStyleId });
  if ('children' in node) node.children.forEach(c => _collectBind(c, acc));
  return acc;
}
function _resolveVar(varId, depth) {
  if (depth === undefined) depth = 0;
  if (depth > 4) return null;
  const v = _allVars.find(v => v.id === varId);
  if (!v) return null;
  const raw = Object.values(v.valuesByMode)[0];
  if (v.resolvedType === 'COLOR') {
    if (raw && 'r' in raw) return { type: 'COLOR', v: raw };
    if (raw?.type === 'VARIABLE_ALIAS') return _resolveVar(raw.id, depth + 1);
  } else if (v.resolvedType === 'FLOAT') {
    if (typeof raw === 'number') return { type: 'FLOAT', v: raw };
    if (raw?.type === 'VARIABLE_ALIAS') return _resolveVar(raw.id, depth + 1);
  }
  return null;
}
const _rawBinds = _collectBind(_defaultV);
const resolved = [];
for (const b of _rawBinds) {
  if (b.varId) {
    const v = _allVars.find(v => v.id === b.varId);
    const tokenName = v ? v.name : b.varId;
    let resolvedVal = '—';
    const res = _resolveVar(b.varId);
    if (res?.type === 'COLOR') {
      const c = res.v; const h = x => Math.round(x * 255).toString(16).padStart(2, '0');
      resolvedVal = `#${h(c.r)}${h(c.g)}${h(c.b)}`;
    } else if (res?.type === 'FLOAT') { resolvedVal = `${res.v}px`; }
    resolved.push({ node: b.node, property: b.property, token: tokenName, resolvedVal });
  } else if (b.styleId) {
    const style = Object.values(DS_CONTEXT.textStyleByName).find(s => s.id === b.styleId);
    resolved.push({ node: b.node, property: 'Text style',
      token: style ? style.name : b.styleId,
      resolvedVal: style ? `${style.fontSize}px / ${typeof style.lineHeight === 'object' ? (style.lineHeight.value ?? '?') : style.lineHeight}` : '—' });
  }
}

// ── FONTS ─────────────────────────────────────────────────────────────────────
let _fam = 'Inter', _fReg = 'Regular', _fSemi = 'Semi Bold', _fBold = 'Bold';
if (_allTextStyles.length > 0) {
  _fam = _allTextStyles[0].fontName.family;
  const _sf = _allTextStyles.filter(s => s.fontName.family === _fam).map(s => s.fontName.style);
  _fSemi = _sf.find(s => /semi.?bold/i.test(s)) ?? 'Semi Bold';
  _fBold = _sf.find(s => /^bold$/i.test(s))     ?? 'Bold';
  _fReg  = _sf.find(s => /^regular$/i.test(s))  ?? 'Regular';
}
await figma.loadFontAsync({ family: _fam, style: _fReg });
await figma.loadFontAsync({ family: _fam, style: _fSemi });
await figma.loadFontAsync({ family: _fam, style: _fBold });

// ── DS-ADAPTIVE PALETTE ───────────────────────────────────────────────────────
function _dsCol(pats, fb) {
  function resolveColor(v, depth) {
    if (depth > 4) return null;
    const raw = Object.values(v.valuesByMode)[0];
    if (raw?.r !== undefined) return { r: raw.r, g: raw.g, b: raw.b };
    if (raw?.type === 'VARIABLE_ALIAS') {
      const target = _allVars.find(x => x.id === raw.id);
      if (target) return resolveColor(target, depth + 1);
    }
    return null;
  }
  for (const p of pats) {
    const v = Object.values(varByName || {}).find(v => v.resolvedType === 'COLOR' && v.name.toLowerCase().includes(p));
    if (v) { const resolved = resolveColor(v, 0); if (resolved) return resolved; }
  }
  return fb;
}
const _cPaper   = _dsCol(['paper','bg/primary','background/primary','surface/default'],   { r: 0.961, g: 0.941, b: 0.922 });
const _cSurface = _dsCol(['surface','bg/secondary','background/secondary','card'],        { r: 0.937, g: 0.918, b: 0.898 });
const _cInk     = _dsCol(['ink/black','ink-black','text/primary','foreground/primary'],   { r: 0.071, g: 0.071, b: 0.078 });
const _cSubtle  = _dsCol(['ink/subtle','ink-subtle','text/secondary','foreground/secondary'], { r: 0.439, g: 0.439, b: 0.569 });
const _cInvBg   = _dsCol(['ink/black-soft','background/inverse','surface/inverse'],       { r: 0.071, g: 0.071, b: 0.078 });
const _cInvTxt  = _dsCol(['ink/white','text/inverse','foreground/inverse'],               { r: 0.737, g: 0.737, b: 0.808 });
const _cBadge   = _dsCol(['overprint/red','overprint-red','error','danger'],              { r: 0.863, g: 0.133, b: 0.000 });
const _cBorder  = _dsCol(['border','stroke/default','divider'],                           { r: 0.851, g: 0.831, b: 0.804 });
const _cDo      = _dsCol(['success','positive','confirm'],                                { r: 0.133, g: 0.545, b: 0.133 });
const _cDont    = _dsCol(['error','danger','destructive'],                                { r: 0.863, g: 0.133, b: 0.000 });

// ── DOC FRAME ─────────────────────────────────────────────────────────────────
let _docSec = figma.currentPage.findOne(n => n.type === 'SECTION' && n.name === 'Documentation');
if (!_docSec) { _docSec = figma.createSection(); _docSec.name = 'Documentation'; figma.currentPage.appendChild(_docSec); }
const _old = figma.currentPage.findOne(n => n.name === `${compName} · Spec`);
if (_old) _old.remove();

const doc = figma.createFrame();
doc.name = `${compName} · Spec`;
doc.layoutMode = 'VERTICAL';
doc.resize(1400, 100);
doc.primaryAxisSizingMode = 'AUTO'; doc.counterAxisSizingMode = 'FIXED';
doc.paddingTop = 64; doc.paddingBottom = 64; doc.paddingLeft = 60; doc.paddingRight = 60;
doc.itemSpacing = 56;
doc.fills = [{ type: 'SOLID', color: _cPaper }];
_docSec.appendChild(doc);

// ── HELPERS ───────────────────────────────────────────────────────────────────
function _mkLabel(parent, text) {
  const t = figma.createText();
  t.fontName = { family: _fam, style: _fSemi }; t.characters = text; t.fontSize = 11;
  t.letterSpacing = { value: 2, unit: 'PIXELS' };
  t.fills = [{ type: 'SOLID', color: _cSubtle }];
  parent.appendChild(t); t.textAutoResize = 'WIDTH_AND_HEIGHT'; return t;
}
function _mkRow(parent, w, isHdr) {
  const row = figma.createFrame();
  row.name = isHdr ? 'Header Row' : 'Row'; row.layoutMode = 'HORIZONTAL';
  row.counterAxisAlignItems = 'MIN'; row.itemSpacing = 0;
  row.paddingTop = 12; row.paddingBottom = 12; row.paddingLeft = 0; row.paddingRight = 0;
  row.primaryAxisSizingMode = 'FIXED'; row.resize(w, 1); row.counterAxisSizingMode = 'AUTO';
  row.fills = isHdr ? [{ type: 'SOLID', color: _cInvBg }] : [];
  parent.appendChild(row); return row;
}
function _mkCell(row, text, width, style) {
  const isH = style === 'header-text', isMono = style === 'mono';
  const cell = figma.createFrame();
  cell.name = 'Cell'; cell.layoutMode = 'VERTICAL';
  cell.paddingTop = 0; cell.paddingBottom = 0; cell.paddingLeft = 16; cell.paddingRight = 16;
  cell.fills = []; row.appendChild(cell); cell.resize(width, 1);
  cell.primaryAxisSizingMode = 'AUTO'; cell.counterAxisSizingMode = 'FIXED';
  const t = figma.createText();
  t.fontName = { family: _fam, style: isH ? _fSemi : _fReg }; t.characters = String(text); t.fontSize = 12;
  t.fills = [{ type: 'SOLID', color: isH ? _cInvTxt : isMono ? _cSubtle : _cInk }];
  cell.appendChild(t); t.textAutoResize = 'HEIGHT'; return cell;
}
function _mkTable(parent, name) {
  const t = figma.createFrame();
  t.name = name; t.layoutMode = 'VERTICAL';
  t.itemSpacing = 0; t.fills = []; t.cornerRadius = 6; t.clipsContent = true;
  parent.appendChild(t); t.layoutSizingHorizontal = 'FILL'; t.resize(1280, 1);
  t.primaryAxisSizingMode = 'AUTO'; t.counterAxisSizingMode = 'FIXED'; return t;
}

// ── SECTION A — HEADER ────────────────────────────────────────────────────────
const _secA = figma.createFrame();
_secA.name = 'Section A · Header'; _secA.layoutMode = 'VERTICAL';
_secA.primaryAxisSizingMode = 'AUTO'; _secA.counterAxisSizingMode = 'FIXED';
_secA.itemSpacing = 8; _secA.fills = []; doc.appendChild(_secA); _secA.layoutSizingHorizontal = 'FILL';

const _tTitle = figma.createText();
_tTitle.fontName = { family: _fam, style: _fBold }; _tTitle.characters = compName; _tTitle.fontSize = 40;
_tTitle.fills = [{ type: 'SOLID', color: _cInk }];
_secA.appendChild(_tTitle); _tTitle.textAutoResize = 'WIDTH_AND_HEIGHT';

const _tSub = figma.createText();
_tSub.fontName = { family: _fam, style: _fReg };
_tSub.characters = compMeta.description || `${compName} — ${compMeta.variantCount} variant${compMeta.variantCount !== 1 ? 's' : ''}`;
_tSub.fontSize = 16; _tSub.fills = [{ type: 'SOLID', color: _cSubtle }];
_secA.appendChild(_tSub); _tSub.textAutoResize = 'WIDTH_AND_HEIGHT';

// ── SECTION B — PREVIEW ───────────────────────────────────────────────────────
const _secB = figma.createFrame();
_secB.name = 'Section B · Preview'; _secB.layoutMode = 'HORIZONTAL';
_secB.primaryAxisAlignItems = 'CENTER'; _secB.counterAxisAlignItems = 'CENTER';
_secB.paddingTop = 40; _secB.paddingBottom = 40; _secB.paddingLeft = 40; _secB.paddingRight = 40;
_secB.fills = [{ type: 'SOLID', color: _cSurface }]; _secB.cornerRadius = 8;
_secB.strokes = [{ type: 'SOLID', color: _cBorder }]; _secB.strokeWeight = 1;
doc.appendChild(_secB); _secB.layoutSizingHorizontal = 'FILL';
_secB.appendChild(_defaultV.createInstance());

// ── SECTION C — VARIANT SHOWCASE ─────────────────────────────────────────────
const _secC = figma.createFrame();
_secC.name = 'Section C · Variants'; _secC.layoutMode = 'HORIZONTAL';
_secC.layoutWrap = 'WRAP';
_secC.counterAxisAlignItems = 'MIN'; _secC.itemSpacing = 24; _secC.counterAxisSpacing = 24;
_secC.paddingTop = 24; _secC.paddingBottom = 24; _secC.paddingLeft = 24; _secC.paddingRight = 24;
_secC.fills = [{ type: 'SOLID', color: _cSurface }]; _secC.cornerRadius = 8;
doc.appendChild(_secC); _secC.layoutSizingHorizontal = 'FILL'; _secC.counterAxisSizingMode = 'AUTO';
const _variants = compSet.type === 'COMPONENT_SET' ? compSet.children : [compSet];
for (const _v of _variants) {
  const _vf = figma.createFrame();
  _vf.layoutMode = 'VERTICAL'; _vf.primaryAxisSizingMode = 'AUTO'; _vf.counterAxisSizingMode = 'AUTO';
  _vf.primaryAxisAlignItems = 'CENTER'; _vf.itemSpacing = 8; _vf.fills = [];
  _secC.appendChild(_vf); _vf.appendChild(_v.createInstance());
  const _vl = figma.createText();
  _vl.fontName = { family: _fam, style: _fSemi };
  _vl.characters = _v.name.replace(/,\s*/g, '\n'); _vl.fontSize = 11; _vl.textAlignHorizontal = 'CENTER';
  _vl.fills = [{ type: 'SOLID', color: _cInk }];
  _vf.appendChild(_vl); _vl.textAutoResize = 'WIDTH_AND_HEIGHT';
  const _vDesc = _variantDesc[_v.name];
  if (_vDesc) {
    const _vdt = figma.createText();
    _vdt.fontName = { family: _fam, style: _fReg };
    _vdt.characters = _vDesc; _vdt.fontSize = 10; _vdt.textAlignHorizontal = 'CENTER';
    _vdt.fills = [{ type: 'SOLID', color: _cSubtle }];
    _vf.appendChild(_vdt); _vdt.textAutoResize = 'WIDTH_AND_HEIGHT';
  }
}

// ── SECTION D — PROPERTIES TABLE ─────────────────────────────────────────────
_mkLabel(doc, 'COMPONENT PROPERTIES');
const _tblD = _mkTable(doc, 'Properties Table');
const _dHdr = _mkRow(_tblD, 1280, true);
_mkCell(_dHdr, 'PROPERTY', 427, 'header-text'); _mkCell(_dHdr, 'TYPE', 427, 'header-text'); _mkCell(_dHdr, 'DEFAULT', 426, 'header-text');
const _propArr = Object.entries(compMeta.componentPropertyDefinitions);
if (_propArr.length === 0) {
  _mkCell(_mkRow(_tblD, 1280, false), '(no component properties defined)', 1280, 'mono');
} else {
  _propArr.forEach(([key, def], i) => {
    const r = _mkRow(_tblD, 1280, false);
    r.fills = i % 2 === 1 ? [{ type: 'SOLID', color: _cSurface }] : [];
    _mkCell(r, key.replace(/#[^#]+$/, ''), 427, 'body'); _mkCell(r, def.type, 427, 'mono'); _mkCell(r, String(def.defaultValue ?? '—'), 426, 'body');
  });
}

// ── SECTION F — SIZING ────────────────────────────────────────────────────────
_mkLabel(doc, 'SIZING');
const _secF = figma.createFrame();
_secF.name = 'Sizing'; _secF.layoutMode = 'VERTICAL';
_secF.itemSpacing = 4; _secF.paddingTop = 16; _secF.paddingBottom = 16; _secF.paddingLeft = 20; _secF.paddingRight = 20;
_secF.fills = [{ type: 'SOLID', color: _cSurface }]; _secF.cornerRadius = 6;
doc.appendChild(_secF); _secF.layoutSizingHorizontal = 'FILL'; _secF.resize(1280, 1);
_secF.primaryAxisSizingMode = 'AUTO'; _secF.counterAxisSizingMode = 'FIXED';
const _szLines = [
  `Width: ${_defaultV.width}px  ·  Height: ${_defaultV.height}px  ·  Variants: ${compMeta.variantCount}`,
  ...resolved.filter(b => ['paddingTop','paddingBottom','paddingLeft','paddingRight','itemSpacing','counterAxisSpacing','cornerRadius'].includes(b.property))
             .map(b => `${b.property}: ${b.resolvedVal}  →  ${b.token}`)
];
for (const _l of _szLines) {
  const _lt = figma.createText();
  _lt.fontName = { family: _fam, style: _fReg }; _lt.characters = _l; _lt.fontSize = 12;
  _lt.fills = [{ type: 'SOLID', color: _cInk }];
  _secF.appendChild(_lt); _lt.textAutoResize = 'WIDTH_AND_HEIGHT';
}

// ── SECTION G — ANATOMY ───────────────────────────────────────────────────────
_mkLabel(doc, 'ANATOMY');
const _wrapper = figma.createFrame();
_wrapper.name = 'Anatomy Wrapper'; _wrapper.layoutMode = 'HORIZONTAL';
_wrapper.primaryAxisSizingMode = 'FIXED'; _wrapper.counterAxisSizingMode = 'FIXED';
_wrapper.clipsContent = false; _wrapper.fills = [];
_wrapper.resize(_defaultV.width, _defaultV.height);
doc.appendChild(_wrapper);
const _anatInst = _defaultV.createInstance();
_wrapper.appendChild(_anatInst); _anatInst.layoutPositioning = 'ABSOLUTE'; _anatInst.x = 0; _anatInst.y = 0;
const _BS = 22;
elements.forEach(({ x, y, w, h }, idx) => {
  const n = idx + 1;
  const bx = x < 100 ? x - _BS - 6 : Math.round(x + w/2 - _BS/2);
  const by = y < 20  ? -_BS - 4     : Math.round(y + h/2 - _BS/2);
  const _b = figma.createEllipse();
  _b.name = `Badge ${n}`; _b.resize(_BS, _BS); _b.fills = [{ type: 'SOLID', color: _cBadge }];
  _wrapper.appendChild(_b); _b.layoutPositioning = 'ABSOLUTE'; _b.x = bx; _b.y = by;
  const _nt = figma.createText();
  _nt.fontName = { family: _fam, style: _fBold }; _nt.characters = String(n);
  _nt.fontSize = n >= 10 ? 9 : 10; _nt.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  _nt.textAlignHorizontal = 'CENTER'; _nt.textAlignVertical = 'CENTER'; _nt.resize(_BS, _BS);
  _wrapper.appendChild(_nt); _nt.layoutPositioning = 'ABSOLUTE'; _nt.x = bx; _nt.y = by;
});
// Anatomy legend
const _tblG = _mkTable(doc, 'Anatomy Legend');
const _gHdr = _mkRow(_tblG, 1280, true);
_mkCell(_gHdr, '#', 80, 'header-text'); _mkCell(_gHdr, 'ELEMENT', 500, 'header-text'); _mkCell(_gHdr, 'TYPE', 700, 'header-text');
elements.forEach(({ name, type }, idx) => {
  const r = _mkRow(_tblG, 1280, false);
  r.fills = idx % 2 === 1 ? [{ type: 'SOLID', color: _cSurface }] : [];
  _mkCell(r, String(idx + 1), 80, 'body'); _mkCell(r, name, 500, 'body'); _mkCell(r, type, 700, 'mono');
});

// ── SECTION H — USAGE GUIDELINES ─────────────────────────────────────────────
_mkLabel(doc, 'USAGE');
const _secH = figma.createFrame();
_secH.name = 'Section H · Usage'; _secH.layoutMode = 'HORIZONTAL';
_secH.primaryAxisSizingMode = 'AUTO'; _secH.counterAxisSizingMode = 'AUTO';
_secH.itemSpacing = 24; _secH.fills = [];
doc.appendChild(_secH);

function _mkUsagePanel(parent, label, rules, borderColor) {
  const panel = figma.createFrame();
  panel.name = label; panel.layoutMode = 'VERTICAL';
  panel.primaryAxisSizingMode = 'AUTO'; panel.counterAxisSizingMode = 'AUTO';
  panel.itemSpacing = 8; panel.paddingTop = 20; panel.paddingBottom = 20; panel.paddingLeft = 20; panel.paddingRight = 20;
  panel.fills = []; panel.cornerRadius = 8;
  panel.strokes = [{ type: 'SOLID', color: borderColor }]; panel.strokeWeight = 2;
  parent.appendChild(panel);
  const lbl = figma.createText();
  lbl.fontName = { family: _fam, style: _fSemi }; lbl.characters = label; lbl.fontSize = 13;
  lbl.fills = [{ type: 'SOLID', color: borderColor }];
  panel.appendChild(lbl); lbl.textAutoResize = 'WIDTH_AND_HEIGHT';
  for (const rule of rules) {
    const rt = figma.createText();
    rt.fontName = { family: _fam, style: _fReg }; rt.characters = `• ${rule}`; rt.fontSize = 12;
    rt.fills = [{ type: 'SOLID', color: _cInk }];
    panel.appendChild(rt); rt.textAutoResize = 'WIDTH_AND_HEIGHT';
  }
}
_mkUsagePanel(_secH, 'Do', _usageDo, _cDo);
_mkUsagePanel(_secH, "Don't", _usageDont, _cDont);

// ── UPDATE COMPONENT DESCRIPTION ──────────────────────────────────────────────
const _specBlock = `[SPEC]
component: ${compName}
variants: ${compMeta.variants.join(' | ')}
properties: ${Object.entries(compMeta.componentPropertyDefinitions).map(([k,v]) => `${k.replace(/#[^#]+$/,'')} (${v.type})`).join(', ') || 'none'}
tokens: ${resolved.slice(0,5).map(b => `${b.property}=${b.token}`).join(', ')}
spec-file: component-specs/${compName}.md
[/SPEC]

`;
const _specComp = figma.currentPage.findOne(n => n.name === compName && (n.type === 'COMPONENT' || n.type === 'COMPONENT_SET'));
if (_specComp) _specComp.description = _specBlock + (_specComp.description || '').replace(/\[SPEC\][\s\S]*?\[\/SPEC\]\n*/g, '');
