// Build the full spec sheet doc frame in Figma.
// Required variables: compName (string), compSet (ComponentSet node), elements (array from read-bounds.js)

// ── FONT LOADING ──────────────────────────────────────────────────────────────

await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
await figma.loadFontAsync({ family: 'Inter', style: 'Semi Bold' });
await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });

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
doc.fills = [{ type: 'SOLID', color: { r: 0.961, g: 0.941, b: 0.922 } }]; // paper
docSection.appendChild(doc);

// ── MAKELABEL HELPER ──────────────────────────────────────────────────────────

function makeLabel(parent, text) {
  const t = figma.createText();
  t.fontName = { family: 'Inter', style: 'Semi Bold' };
  t.characters = text; t.fontSize = 11;
  t.letterSpacing = { value: 2, unit: 'PIXELS' };
  t.fills = [{ type: 'SOLID', color: { r: 0.439, g: 0.439, b: 0.569 } }];
  parent.appendChild(t);
  return t;
}

// ── SECTION B — PREVIEW ───────────────────────────────────────────────────────

const previewFrame = figma.createFrame();
previewFrame.layoutMode = 'HORIZONTAL';
previewFrame.primaryAxisAlignItems = 'CENTER'; previewFrame.counterAxisAlignItems = 'CENTER';
previewFrame.paddingTop = 40; previewFrame.paddingBottom = 40;
previewFrame.paddingLeft = 40; previewFrame.paddingRight = 40;
previewFrame.fills = [{ type: 'SOLID', color: { r: 0.937, g: 0.918, b: 0.898 } }];
previewFrame.cornerRadius = 8;
previewFrame.strokes = [{ type: 'SOLID', color: { r: 0.851, g: 0.831, b: 0.804 } }];
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
showcaseFrame.fills = [{ type: 'SOLID', color: { r: 0.937, g: 0.918, b: 0.898 } }];
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
  vLabel.fontName = { family: 'Inter', style: 'Regular' };
  vLabel.characters = variant.name.replace(/,\s*/g, '\n');
  vLabel.fontSize = 10; vLabel.textAlignHorizontal = 'CENTER';
  vLabel.fills = [{ type: 'SOLID', color: { r: 0.439, g: 0.439, b: 0.569 } }];
  vFrame.appendChild(vLabel);
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
  badge.fills = [{ type: 'SOLID', color: { r: 0.863, g: 0.133, b: 0.000 } }]; // overprint-red
  wrapper.appendChild(badge);
  badge.layoutPositioning = 'ABSOLUTE';
  badge.x = bx; badge.y = by;

  const numT = figma.createText();
  numT.fontName = { family: 'Inter', style: 'Bold' };
  numT.characters = String(n);
  numT.fontSize = n >= 10 ? 9 : 10;
  numT.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  numT.textAlignHorizontal = 'CENTER'; numT.textAlignVertical = 'CENTER';
  numT.resize(SIZE, SIZE);
  wrapper.appendChild(numT);
  numT.layoutPositioning = 'ABSOLUTE';
  numT.x = bx; numT.y = by;
});
