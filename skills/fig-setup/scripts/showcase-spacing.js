// Spacing showcase patterns — spacing bars, border radius rectangles, border width rectangles.

// ── SPACING BARS ──────────────────────────────────────────────────────────────

// For each space/component/* and space/layout/* variable:
const bar = figma.createRectangle();
bar.name = spacingVar.name;
bar.resize(1, 24);                              // height 24 = structural, documented exception
bar.setBoundVariable('width', spacingVar);      // width = spacing value, responds to variable
const barPaint = { type: 'SOLID', color: { r: 0, g: 0, b: 0 } };
bar.fills = [barPaint];
bar.setBoundVariableForPaint(bar.fills[0], 'color', bgBrandVar);  // fill = color/bg/brand

const barLabel = figma.createText();
barLabel.textStyleId = labelMdStyle.id;
const resolvedSpacingPx = spacingVar.resolveForConsumer(bar).value;
barLabel.characters = `${spacingVar.name}: ${resolvedSpacingPx}px`;
const barLabelPaint = { type: 'SOLID', color: { r: 0, g: 0, b: 0 } };
barLabel.fills = [barLabelPaint];
barLabel.setBoundVariableForPaint(barLabel.fills[0], 'color', textDefaultVar);

// ── BORDER RADIUS RECTANGLES ──────────────────────────────────────────────────

// Order: none, xs, sm, md, lg, xl, 2xl, full
// For each space/radius/* variable:
const rect = figma.createRectangle();
rect.resize(64, 64);  // structural — documented exception
rect.setBoundVariable('cornerRadius', radiusVar);  // corner radius = the variable value
const rectPaint = { type: 'SOLID', color: { r: 0, g: 0, b: 0 } };
rect.fills = [rectPaint];
rect.setBoundVariableForPaint(rect.fills[0], 'color', bgBrandVar);

const radiusLabel = figma.createText();
radiusLabel.textStyleId = labelMdStyle.id;
const resolvedRadiusPx = radiusVar.resolveForConsumer(rect).value;
radiusLabel.characters = `${radiusVar.name}: ${resolvedRadiusPx}px`;
const radiusLabelPaint = { type: 'SOLID', color: { r: 0, g: 0, b: 0 } };
radiusLabel.fills = [radiusLabelPaint];
radiusLabel.setBoundVariableForPaint(radiusLabel.fills[0], 'color', textDefaultVar);

// ── BORDER WIDTH RECTANGLES ───────────────────────────────────────────────────

// Order: hairline, default, medium, thick
// For each space/border/* variable:
const borderRect = figma.createRectangle();
borderRect.resize(64, 32);  // structural — documented exception
borderRect.fills = [];      // no fill
borderRect.setBoundVariable('strokeWeight', borderVar);  // stroke weight = the variable value
borderRect.strokeAlign = 'INSIDE';
const strokePaint = { type: 'SOLID', color: { r: 0, g: 0, b: 0 } };
borderRect.strokes = [strokePaint];
borderRect.setBoundVariableForPaint(borderRect.strokes[0], 'color', borderDefaultVar);  // color/border/default

const borderLabel = figma.createText();
borderLabel.textStyleId = labelMdStyle.id;
const resolvedBorderPx = borderVar.resolveForConsumer(borderRect).value;
borderLabel.characters = `${borderVar.name}: ${resolvedBorderPx}px`;
const borderLabelPaint = { type: 'SOLID', color: { r: 0, g: 0, b: 0 } };
borderLabel.fills = [borderLabelPaint];
borderLabel.setBoundVariableForPaint(borderLabel.fills[0], 'color', textDefaultVar);
