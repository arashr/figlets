// Build the full spec sheet doc frame in Figma.
// Requires detect-ds-context.js pasted above (provides _allTextStyles, varByName).
// Required variables: compName (string), compSet (ComponentSet node), elements (array from read-bounds.js)

// ── FONT DETECTION ────────────────────────────────────────────────────────────
// Use whatever font family the DS text styles use for doc sheet labels.
// Detect the real semibold/bold style name — avoids 'Semi Bold' vs 'SemiBold' mismatch.

let _docFamily   = 'Inter';
let _docRegular  = 'Regular';
let _docSemibold = 'Semi Bold';
let _docBold     = 'Bold';

if (_allTextStyles.length > 0) {
  _docFamily = _allTextStyles[0].fontName.family;
  const stylesForFamily = _allTextStyles
    .filter(s => s.fontName.family === _docFamily)
    .map(s => s.fontName.style);
  _docSemibold = stylesForFamily.find(s => /semi.?bold/i.test(s)) ?? 'Semi Bold';
  _docBold     = stylesForFamily.find(s => /^bold$/i.test(s))     ?? 'Bold';
  _docRegular  = stylesForFamily.find(s => /^regular$/i.test(s))  ?? 'Regular';
}

await figma.loadFontAsync({ family: _docFamily, style: _docRegular });
await figma.loadFontAsync({ family: _docFamily, style: _docSemibold });
await figma.loadFontAsync({ family: _docFamily, style: _docBold });

// ── SPEC SHEET PALETTE (DS-adaptive) ─────────────────────────────────────────
// Try to resolve spec sheet colors from the live DS by name pattern.
// Falls back to neutral parchment/ink values when no matching token is found.
// Searches varByName for any COLOR variable whose name contains one of the given patterns.

function _dsColor(namePatterns, fallback) {
  for (const pat of namePatterns) {
    const v = Object.values(varByName || {}).find(v =>
      v.resolvedType === 'COLOR' && v.name.toLowerCase().includes(pat));
    if (v) {
      const raw = Object.values(v.valuesByMode)[0];
      if (raw?.r !== undefined) return { r: raw.r, g: raw.g, b: raw.b };
    }
  }
  return fallback;
}

const _sPaper   = _dsColor(['paper', 'bg/primary',   'background/primary',   'surface/default'],  { r: 0.961, g: 0.941, b: 0.922 });
const _sSurface = _dsColor(['surface', 'bg/secondary','background/secondary', 'card'],             { r: 0.937, g: 0.918, b: 0.898 });
const _sInk     = _dsColor(['ink/black','ink-black',  'text/primary',  'foreground/primary'],      { r: 0.071, g: 0.071, b: 0.078 });
const _sSubtle  = _dsColor(['ink/subtle','ink-subtle','text/secondary','foreground/secondary'],    { r: 0.439, g: 0.439, b: 0.569 });
const _sInverse = _dsColor(['ink/black-soft','background/inverse','surface/inverse'],              { r: 0.071, g: 0.071, b: 0.078 });
const _sInvTxt  = _dsColor(['ink/white','text/inverse','foreground/inverse'],                      { r: 0.737, g: 0.737, b: 0.808 });
const _sBadge   = _dsColor(['overprint/red','overprint-red','error','danger'],                     { r: 0.863, g: 0.133, b: 0.000 });
const _sBorder  = _dsColor(['border','stroke/default','divider'],                                  { r: 0.851, g: 0.831, b: 0.804 });

// ── FIND OR CREATE DOCUMENTATION SECTION + REMOVE OLD SPEC ───────────────────

let docSection = figma.currentPage.findOne(n => n.type === 'SECTION' && n.name === 'Documentation');
if (!docSection) {
  docSection = figma.createSection();
  docSection.name = 'Documentation';
  figma.currentPage.appendChild(docSection);
}
const oldSpec = figma.currentPage.findOne(n => n.name === `${compName} · Spec`);
if (oldSpec) oldSpec.remove();

// ── DOC FRAME ─────────────────────────────────────────────────────────────────

const doc = figma.createFrame();
doc.name = `${compName} · Spec`;
doc.layoutMode = 'VERTICAL';
doc.primaryAxisSizingMode = 'AUTO';
doc.counterAxisSizingMode = 'FIXED';
doc.resize(1400, 100);
doc.paddingTop = 64; doc.paddingBottom = 64;
doc.paddingLeft = 60; doc.paddingRight = 60; // 1280px inner
doc.itemSpacing = 56;
doc.fills = [{ type: 'SOLID', color: _sPaper }];
docSection.appendChild(doc);

// ── MAKELABEL HELPER ──────────────────────────────────────────────────────────

function makeLabel(parent, text) {
  const t = figma.createText();
  t.fontName = { family: _docFamily, style: _docSemibold };
  t.characters = text; t.fontSize = 11;
  t.letterSpacing = { value: 2, unit: 'PIXELS' };
  t.fills = [{ type: 'SOLID', color: _sSubtle }];
  parent.appendChild(t);
  t.textAutoResize = 'WIDTH_AND_HEIGHT'; // must be set AFTER appendChild
  return t;
}

// ── TABLE ROW HELPER ──────────────────────────────────────────────────────────
// Creates a full-width row with height that hugs its content.
// Always use makeCell() to populate rows — never append bare text nodes to a row.
//
// Usage: const row = makeTableRow(tableFrame, 1280, isHeader);
//        makeCell(row, 'Column text', 320, 'body');
function makeTableRow(parent, totalW, isHeader) {
  const row = figma.createFrame();
  row.name = isHeader ? 'Header Row' : 'Row';
  row.layoutMode = 'HORIZONTAL';
  row.counterAxisAlignItems = 'MIN'; // top-align cells (correct for multi-line content)
  row.itemSpacing = 0;
  row.paddingTop = 12; row.paddingBottom = 12;
  row.paddingLeft = 0; row.paddingRight = 0;
  // Set AUTO sizing mode FIRST, then fix the width — prevents resize() from locking height.
  row.primaryAxisSizingMode = 'FIXED';
  row.counterAxisSizingMode = 'AUTO';
  row.resize(totalW, 1); // width fixed; height auto-expands to fit tallest cell
  row.fills = isHeader ? [{ type: 'SOLID', color: _sInverse }] : [];
  parent.appendChild(row);
  return row;
}

// ── MAKECELL HELPER ───────────────────────────────────────────────────────────
// Appends a fixed-width cell + text node to a row. Height always hugs content.
// NEVER create bare text nodes directly in a row — always use this helper.
//
// style: 'header-text' — semibold, muted (for use on dark header rows)
//        'body'        — regular, ink primary (for use on light data rows)
//        'mono'        — regular, ink subtle (for token names / resolved values)
//
// Usage: makeCell(row, 'PROPERTY', 320, 'header-text');
//        makeCell(row, 'paddingTop', 320, 'body');
function makeCell(row, text, width, style) {
  const isHeaderText = style === 'header-text';
  const isMono       = style === 'mono';

  const cell = figma.createFrame();
  cell.name = 'Cell';
  cell.layoutMode = 'VERTICAL';
  cell.primaryAxisSizingMode = 'AUTO';  // height hugs text content
  cell.counterAxisSizingMode = 'FIXED'; // width is fixed
  cell.paddingTop = 0; cell.paddingBottom = 0;
  cell.paddingLeft = 16; cell.paddingRight = 16;
  cell.fills = [];
  row.appendChild(cell);
  cell.resize(width, 1); // set width AFTER appendChild; height auto-expands

  const t = figma.createText();
  t.fontName = { family: _docFamily, style: isHeaderText ? _docSemibold : _docRegular };
  t.characters = String(text);
  t.fontSize = 12;
  t.fills = [{ type: 'SOLID', color: isHeaderText ? _sInvTxt : isMono ? _sSubtle : _sInk }];
  cell.appendChild(t);
  t.textAutoResize = 'HEIGHT'; // width fixed by cell frame; height expands to fit content
  return cell;
}

// ── SECTION B — PREVIEW ───────────────────────────────────────────────────────

const previewFrame = figma.createFrame();
previewFrame.layoutMode = 'HORIZONTAL';
previewFrame.primaryAxisAlignItems = 'CENTER'; previewFrame.counterAxisAlignItems = 'CENTER';
previewFrame.paddingTop = 40; previewFrame.paddingBottom = 40;
previewFrame.paddingLeft = 40; previewFrame.paddingRight = 40;
previewFrame.fills = [{ type: 'SOLID', color: _sSurface }];
previewFrame.cornerRadius = 8;
previewFrame.strokes = [{ type: 'SOLID', color: _sBorder }];
previewFrame.strokeWeight = 1;
doc.appendChild(previewFrame);
previewFrame.layoutSizingHorizontal = 'FILL';

const defaultVariant = compSet.children.find(c => c.name.includes('Default') || c.name.includes('Full')) || compSet.children[0];
const inst = defaultVariant.createInstance();
previewFrame.appendChild(inst);
inst.layoutSizingHorizontal = 'FILL';

// ── SECTION C — VARIANT SHOWCASE (up to 6 variants with labels) ───────────────

const showcaseFrame = figma.createFrame();
showcaseFrame.layoutMode = 'HORIZONTAL';
showcaseFrame.primaryAxisSizingMode = 'AUTO'; showcaseFrame.counterAxisSizingMode = 'AUTO';
showcaseFrame.primaryAxisAlignItems = 'CENTER';
showcaseFrame.itemSpacing = 16;
showcaseFrame.paddingTop = 24; showcaseFrame.paddingBottom = 24;
showcaseFrame.paddingLeft = 24; showcaseFrame.paddingRight = 24;
showcaseFrame.fills = [{ type: 'SOLID', color: _sSurface }];
showcaseFrame.cornerRadius = 8;
doc.appendChild(showcaseFrame);

const displayVariants = compSet.children.slice(0, 6);
for (const variant of displayVariants) {
  const vFrame = figma.createFrame();
  vFrame.layoutMode = 'VERTICAL'; vFrame.primaryAxisSizingMode = 'AUTO'; vFrame.counterAxisSizingMode = 'AUTO';
  vFrame.primaryAxisAlignItems = 'CENTER'; vFrame.itemSpacing = 8; vFrame.fills = [];
  showcaseFrame.appendChild(vFrame);

  const vInst = variant.createInstance();
  vFrame.appendChild(vInst);

  const vLabel = figma.createText();
  vLabel.fontName = { family: _docFamily, style: _docRegular };
  vLabel.characters = variant.name.replace(/,\s*/g, '\n');
  vLabel.fontSize = 10; vLabel.textAlignHorizontal = 'CENTER';
  vLabel.fills = [{ type: 'SOLID', color: _sSubtle }];
  vFrame.appendChild(vLabel);
  vLabel.textAutoResize = 'WIDTH_AND_HEIGHT'; // must be set AFTER appendChild
}

// ── SECTION G — ANATOMY WRAPPER + ANNOTATION BADGES ──────────────────────────

// wrapper = auto-layout frame at component natural width, HORIZONTAL to allow ABSOLUTE children
// Place a live instance at ABSOLUTE x=0, y=0
// For each named element from read-bounds.js, place an annotation badge

elements.forEach(({ name, x, y, w, h }, idx) => {
  const n = idx + 1;
  const SIZE = 22;

  // Place badge at element's top-left corner, offset slightly outside
  // For left-side elements (x < 100): badge goes left of element
  // For top elements (y < 20): badge goes above
  // Otherwise: badge at element center
  const bx = x < 100 ? x - SIZE - 6 : Math.round(x + w/2 - SIZE/2);
  const by = y < 20  ? -SIZE - 4     : Math.round(y + h/2 - SIZE/2);

  const badge = figma.createEllipse();
  badge.name = `Badge ${n}`;
  badge.resize(SIZE, SIZE);
  badge.fills = [{ type: 'SOLID', color: _sBadge }];
  wrapper.appendChild(badge);
  badge.layoutPositioning = 'ABSOLUTE';
  badge.x = bx; badge.y = by;

  const numT = figma.createText();
  numT.fontName = { family: _docFamily, style: _docBold };
  numT.characters = String(n);
  numT.fontSize = n >= 10 ? 9 : 10;
  numT.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  numT.textAlignHorizontal = 'CENTER'; numT.textAlignVertical = 'CENTER';
  numT.resize(SIZE, SIZE);
  wrapper.appendChild(numT);
  numT.layoutPositioning = 'ABSOLUTE';
  numT.x = bx; numT.y = by;
});
