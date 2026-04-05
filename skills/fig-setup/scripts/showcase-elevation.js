// Elevation demo cards pattern — one card per elevation level with Effect Style applied.
// Switching Light ↔ Dark mode changes the shadow color via color/shadow/key and
// color/shadow/ambient — dark mode uses white-based scrims (scrim/white/20 / scrim/white/8)
// to create a subtle light glow effect.

// For each level 0–5:
const card = figma.createFrame();
card.resize(120, 80);  // structural — documented exception
card.cornerRadius = 8; // bind to space/radius/md if available: card.setBoundVariable('cornerRadius', radiusMdVar)
card.clipsContent = false;  // effects must show OUTSIDE the card boundary

const cardPaint = { type: 'SOLID', color: { r: 0, g: 0, b: 0 } };
card.fills = [cardPaint];
card.setBoundVariableForPaint(card.fills[0], 'color', bgDefaultVar);

// Apply the Effect Style by name
const effectStyle = figma.getLocalEffectStyles().find(s => s.name === `elevation/${level}`);
if (effectStyle) card.effectStyleId = effectStyle.id;

// Label — type/label/md text style
const label = figma.createText();
label.textStyleId = labelMdStyle.id;
label.characters = `elevation/${level}`;
const labelPaint = { type: 'SOLID', color: { r: 0, g: 0, b: 0 } };
label.fills = [labelPaint];
label.setBoundVariableForPaint(label.fills[0], 'color', textDefaultVar);
