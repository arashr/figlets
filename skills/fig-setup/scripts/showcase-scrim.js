// Scrim overlay demo pattern — before/after demo showing content bg alone vs. bg + scrim layered.
// Uses multiple fills on a single frame (Figma stacks fills top-to-bottom).
// For each scrim semantic variable: overlay, hover, pressed, disabled, selected.

// Switching Light ↔ Dark mode on the frame changes the scrim value
// (e.g. hover switches from scrim/black/8 to scrim/white/8) — this is the live test.

const demoFrame = figma.createFrame();
demoFrame.resize(120, 56);  // structural — documented exception
demoFrame.layoutMode = 'NONE';

// Base fill — content background
const basePaint = { type: 'SOLID', color: { r: 0, g: 0, b: 0 } };
// Scrim fill — layered on top
const scrimPaint = { type: 'SOLID', color: { r: 0, g: 0, b: 0 } };

const boundBase  = figma.variables.setBoundVariableForPaint(basePaint,  'color', bgDefaultVar);
const boundScrim = figma.variables.setBoundVariableForPaint(scrimPaint, 'color', scrimSemanticVar);

// Figma fills: index 0 = BOTTOM, last index = TOP (rendered over lower fills)
demoFrame.fills = [boundBase, boundScrim];  // base at bottom, scrim on top

// Label — type/label/md text style
const label = figma.createText();
label.textStyleId = labelMdStyle.id;
label.characters = scrimVar.name;  // e.g. 'color/scrim/hover'
const labelPaint = { type: 'SOLID', color: { r: 0, g: 0, b: 0 } };
label.fills = [labelPaint];
label.setBoundVariableForPaint(label.fills[0], 'color', textDefaultVar);
