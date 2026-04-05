// Color showcase patterns for the Token Showcase.
// Section A: primitive color ramps with WCAG contrast badges.
// Section B: semantic bg/fg pairs.

// ── SECTION A — PRIMITIVE RAMPS ───────────────────────────────────────────────

// For each primitive color variable (e.g. color/[hue]/500):
const swatch = figma.createFrame();
swatch.resize(56, 56);  // structural size — documented exception
const paint = { type: 'SOLID', color: { r: 0, g: 0, b: 0 } };
swatch.fills = [paint];
swatch.setBoundVariableForPaint(swatch.fills[0], 'color', primitiveVar);

// Resolve for contrast calculation (done at build time)
const resolvedVal = primitiveVar.resolveForConsumer(swatch).value; // {r,g,b}
const hex = rgbToHex(resolvedVal);
const wcagVsWhite = computeWCAGRatio(hex, '#FFFFFF');
const wcagVsBlack = computeWCAGRatio(hex, '#000000');

// Step label
const stepLabel = figma.createText();
stepLabel.textStyleId = labelMdStyle.id;
stepLabel.characters = stepName;   // e.g. '/500'

// Hex label
const hexLabel = figma.createText();
hexLabel.textStyleId = labelSmStyle.id;
hexLabel.characters = hex;

// Contrast badge vs white
const badgeWhite = figma.createFrame();
const passWhite = wcagVsWhite >= 4.5;
const whiteBasePaint = { type: 'SOLID', color: { r: 0, g: 0, b: 0 } };
badgeWhite.fills = [whiteBasePaint];
badgeWhite.setBoundVariableForPaint(badgeWhite.fills[0], 'color',
  passWhite ? successSubtleVar : dangerSubtleVar);
const badgeWhiteText = figma.createText();
badgeWhiteText.textStyleId = labelSmStyle.id;
const whiteTextPaint = { type: 'SOLID', color: { r: 0, g: 0, b: 0 } };
badgeWhiteText.fills = [whiteTextPaint];
badgeWhiteText.setBoundVariableForPaint(badgeWhiteText.fills[0], 'color',
  passWhite ? textSuccessVar : textDangerVar);
badgeWhiteText.characters = `⬜ ${wcagVsWhite.toFixed(1)}:1 ${passWhite ? '✓ AA' : '✗'}`;

// Same pattern for badge vs black (⬛)

// WCAG 2.2 AA = 4.5:1 normal text, 3:1 large text / icons.

// ── SECTION B — SEMANTIC PAIRS ────────────────────────────────────────────────

// For each pair: { bg: 'color/bg/default', fg: 'color/text/default', label: 'default' }, etc.
// Show pairings for: default, brand, danger, success, warning, info

const bgSwatch = figma.createFrame();
bgSwatch.resize(56, 56);  // structural — documented exception
const bgPaint = { type: 'SOLID', color: { r: 0, g: 0, b: 0 } };
bgSwatch.fills = [bgPaint];
bgSwatch.setBoundVariableForPaint(bgSwatch.fills[0], 'color', bgSemanticVar);

const fgSwatch = figma.createFrame();
fgSwatch.resize(56, 56);
const fgPaint = { type: 'SOLID', color: { r: 0, g: 0, b: 0 } };
fgSwatch.fills = [fgPaint];
fgSwatch.setBoundVariableForPaint(fgSwatch.fills[0], 'color', fgSemanticVar);

// Contrast badge — same pattern as section A
// Pair labels use type/label/md text style

// Switching the showcase frame's Color/Semantics mode (Light ↔ Dark) updates all
// semantic swatches live — this is the visual test the showcase is designed for.
