// Patterns reference — adapt variable names and values for the component being built.
// Covers: node creation order, text node, component TEXT property, combineAsVariants
// wrapper binding, boolean property, component description, variable mode binding loop,
// and instance type mode set.

// Requires detect-ds-context.js pasted above (provides DS_CONTEXT).

// ── NODE CREATION ORDER ───────────────────────────────────────────────────────

// 1. Load fonts first — use the family detected from DS_CONTEXT, never hardcode
// Read detected family from text styles or string variables:
const _detectedFamily = DS_CONTEXT.hasTextStyles
  ? (Object.values(DS_CONTEXT.textStyleByName)[0]?.fontName?.family || 'Inter')
  : (Object.values(DS_CONTEXT.varByName).find(v => v.resolvedType === 'STRING' && /family/i.test(v.name))
      ? Object.values(Object.values(DS_CONTEXT.varByName).find(v => v.resolvedType === 'STRING' && /family/i.test(v.name)).valuesByMode)[0]
      : 'Inter');
await figma.loadFontAsync({ family: _detectedFamily, style: 'Regular' });
await figma.loadFontAsync({ family: _detectedFamily, style: 'Semi Bold' });
await figma.loadFontAsync({ family: _detectedFamily, style: 'Bold' });

// 2. Create node and set non-layout properties
const comp = figma.createComponent();
comp.name = 'ComponentName 1.0.0'; // new components always start at 1.0.0
comp.layoutMode = 'HORIZONTAL';
comp.primaryAxisSizingMode = 'AUTO';
comp.counterAxisSizingMode = 'AUTO';
comp.paddingTop = N; // raw value first
comp.fills = [{ type: 'SOLID', color: { r, g, b } }]; // {r,g,b} only — no 'a'

// 3. Append to parent
section.appendChild(comp);

// 4. Bind variables (after append)
bindFill(comp, 'token-name');
bindNum(comp, 'paddingTop', 'token-name');

// 5. Create children, append, then set FILL sizing
const child = figma.createFrame();
comp.appendChild(child);
child.layoutSizingHorizontal = 'FILL'; // AFTER appendChild

// ── TEXT NODE PATTERN ─────────────────────────────────────────────────────────

// DS_CONTEXT.typographyStrategy drives how text nodes are bound:
//   'text-styles' → apply textStyleId (bundles fontSize, lineHeight, weight, tracking, family)
//   'variables'   → bind individual FLOAT variables (fontSize at minimum)
//   'none'        → no tokens available; note as gap in build summary

// Lookup by name (exact), then nearest by fontSize within the same role prefix.
// Returns true if a style was applied, false otherwise.
function applyTextStyle(node, styleName) {
  if (!DS_CONTEXT.hasTextStyles) return false;
  const style = DS_CONTEXT.textStyleByName[styleName];
  if (style) { node.textStyleId = style.id; return true; }
  // Nearest within same role prefix (e.g. 'body/' for 'body/md')
  const role = styleName.split('/')[0];
  const target = node.fontSize;
  let nearest = null, nearestDist = Infinity;
  for (const s of Object.values(DS_CONTEXT.textStyleByName)) {
    if (!s.name.startsWith(role + '/')) continue;
    const dist = Math.abs((s.fontSize || 0) - target);
    if (dist < nearestDist) { nearest = s; nearestDist = dist; }
  }
  if (nearest) { node.textStyleId = nearest.id; return true; }
  return false;
}

// Font must still be loaded before setting fontName / characters.
// _detectedFamily is set in the NODE CREATION ORDER block above.
await figma.loadFontAsync({ family: _detectedFamily, style: 'Regular' });

const label = figma.createText();
label.fontName = { family: _detectedFamily, style: 'Regular' };
label.characters = 'Label text';
label.fills = [{ type: 'SOLID', color: { r, g, b } }];
comp.appendChild(label);               // append first
label.layoutSizingHorizontal = 'FILL'; // then FILL
label.textAutoResize = 'HEIGHT';       // then textAutoResize
bindFill(label, 'token-name');

// Apply typography — strategy from DS_CONTEXT
if (DS_CONTEXT.typographyStrategy === 'text-styles') {
  applyTextStyle(label, 'body/md'); // substitute correct style name from DS
} else if (DS_CONTEXT.typographyStrategy === 'variables') {
  bindNum(label, 'fontSize', 'typography/body/md/size'); // substitute correct variable name
}
// 'none' → leave unbound, flag as token gap in build summary

// ── COMPONENT TEXT PROPERTY ───────────────────────────────────────────────────

// After creating all text nodes, expose each as a component property:
comp.addComponentProperty('label', 'TEXT', 'Default text');
const propKey = Object.keys(comp.componentPropertyDefinitions).find(k => k.startsWith('label'));
if (propKey) textNode.componentPropertyReferences = { characters: propKey };

// ── COMBINEASVARIANTS WRAPPER BINDING ─────────────────────────────────────────

// After combineAsVariants, bind the new COMPONENT_SET wrapper's hardcoded defaults:
const set = figma.combineAsVariants(variants, pg);
set.name = 'ComponentName 1.0.0'; // new: 1.0.0 | update: bump per versioning rule
// ... set layoutMode, itemSpacing, padding ...

// Bind the wrapper's own tokens
bindRadius(set, 'xs');           // 5px default → xs (4px nearest)
bindNum(set, 'paddingTop',    'md');
bindNum(set, 'paddingBottom', 'md');
bindNum(set, 'paddingLeft',   'md');
bindNum(set, 'paddingRight',  'md');
bindNum(set, 'itemSpacing',   'sm');
try { bindNum(set, 'counterAxisSpacing', 'sm'); } catch(e) {}

// ── BOOLEAN PROPERTY PATTERN ──────────────────────────────────────────────────

// On the COMPONENT (not COMPONENT_SET):
comp.addComponentProperty('showFooter', 'BOOLEAN', true);
const boolPropKey = Object.keys(comp.componentPropertyDefinitions).find(k => k.startsWith('showFooter'));
// Bind to the frame that should show/hide:
const footerFrame = comp.findOne(n => n.name === 'Footer');
if (boolPropKey && footerFrame) footerFrame.componentPropertyReferences = { visible: boolPropKey };

// ── COMPONENT DESCRIPTION APPLY ───────────────────────────────────────────────

const targetComp = figma.currentPage.findOne(n =>
  n.name === 'YourComponent' && (n.type === 'COMPONENT' || n.type === 'COMPONENT_SET'));
if (targetComp) targetComp.description = `<description>`;

// ── VARIABLE MODE TYPE COLLECTION — BIND TO ALL VARIANTS ─────────────────────

// Bind type variables to each state variant — identical binding across all variants
for (const variant of set.children) {
  const fills = [{ type: 'SOLID', color: { r: 0.071, g: 0.071, b: 0.078 } }];
  const f = figma.variables.setBoundVariableForPaint(fills[0], 'color', bgVar);
  variant.fills = [f];
  // bind text, stroke, etc. similarly
}

// ── INSTANCE TYPE MODE SET ────────────────────────────────────────────────────

// In consuming code or when placing the component:
const inst = buttonVariant.createInstance();
inst.setExplicitVariableModeForCollection(typeColl, ghostMode); // → Ghost type
