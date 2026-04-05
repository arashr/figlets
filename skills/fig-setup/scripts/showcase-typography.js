// Typography showcase pattern — one sample text per text style with metadata label.
// The text style handles all font property bindings.
// Text fill must still be explicitly bound to a semantic color variable.

// For each of the 15 text styles:
const sampleText = figma.createText();
sampleText.textStyleId = textStyle.id;    // applies all variable-bound properties
sampleText.characters = `${styleName} — The quick brown fox jumps over the lazy dog`;
// text fill bound to color/text/default semantic variable:
const samplePaint = { type: 'SOLID', color: { r: 0, g: 0, b: 0 } };
sampleText.fills = [samplePaint];
sampleText.setBoundVariableForPaint(sampleText.fills[0], 'color', textDefaultVar);

// Metadata label — type/label/sm style
const metaLabel = figma.createText();
metaLabel.textStyleId = labelSmStyle.id;
metaLabel.characters = `${styleName} · [size]px / w[weight] / lh[lineHeight]px`;
const metaPaint = { type: 'SOLID', color: { r: 0, g: 0, b: 0 } };
metaLabel.fills = [metaPaint];
metaLabel.setBoundVariableForPaint(metaLabel.fills[0], 'color', textSubtleVar);
