// Substitutions required before running:
//   suggestedVarName — the variable name to bind
//   nodeId          — the Figma node ID
//   property        — violation property name (e.g. 'Fill color', 'Stroke weight')
//   fillIndex       — fill array index (Fill color violations only)
//   strokeIndex     — stroke array index (Stroke color violations only)

const allVars = await figma.variables.getLocalVariablesAsync();
const v = allVars.find(x => x.name === suggestedVarName);
if (!v) return 'VAR_NOT_FOUND';
const node = await figma.getNodeByIdAsync(nodeId);
if (!node) return 'NODE_NOT_FOUND';

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
if (property === 'Font size') { node.setBoundVariable('fontSize', v); }
return 'OK';
