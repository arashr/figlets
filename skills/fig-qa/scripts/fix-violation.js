// Substitutions required before running:
//   suggestedVarName — variable name OR text style name (for 'Text style' violations)
//   nodeId          — the Figma node ID
//   property        — violation property name (e.g. 'Fill color', 'Stroke weight', 'Text style')
//   fillIndex       — fill array index (Fill color violations only)
//   strokeIndex     — stroke array index (Stroke color violations only)

const node = await figma.getNodeByIdAsync(nodeId);
if (!node) return 'NODE_NOT_FOUND';

// Text style violations — apply via textStyleId, not variable binding
if (property === 'Text style') {
  const allStyles = await figma.getLocalTextStylesAsync();
  const style = allStyles.find(s => s.name === suggestedVarName);
  if (!style) return 'STYLE_NOT_FOUND';
  node.textStyleId = style.id;
  return 'OK';
}

const allVars = await figma.variables.getLocalVariablesAsync();
const v = allVars.find(x => x.name === suggestedVarName);
if (!v) return 'VAR_NOT_FOUND';

if (property === 'Fill color') {
  const fills = JSON.parse(JSON.stringify(node.fills));
  fills[fillIndex] = figma.variables.setBoundVariableForPaint(fills[fillIndex], 'color', v);
  node.fills = fills;
}
if (property === 'Stroke color') {
  const strokes = JSON.parse(JSON.stringify(node.strokes));
  strokes[strokeIndex] = figma.variables.setBoundVariableForPaint(strokes[strokeIndex], 'color', v);
  node.strokes = strokes;
}
if (property === 'Stroke weight') {
  if (node.type === 'TEXT') { node.setBoundVariable('strokeWeight', v); }
  else { ['strokeTopWeight','strokeBottomWeight','strokeLeftWeight','strokeRightWeight']
    .forEach(p => node.setBoundVariable(p, v)); }
}
if (property === 'Corner radius') {
  ['topLeftRadius','topRightRadius','bottomLeftRadius','bottomRightRadius']
    .forEach(p => node.setBoundVariable(p, v));
}
if (['paddingTop','paddingBottom','paddingLeft','paddingRight','itemSpacing','counterAxisSpacing'].includes(property)) {
  node.setBoundVariable(property, v);
}
// Font size — used when DS has no text styles (variable-only DS)
if (property === 'Font size') { node.setBoundVariable('fontSize', v); }
return 'OK';
