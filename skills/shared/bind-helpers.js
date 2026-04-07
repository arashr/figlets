// Shared variable binding helpers. Prepend to any use_figma script that needs variable binding.

const allVars = await figma.variables.getLocalVariablesAsync();
const varByName = {};
allVars.forEach(v => { varByName[v.name] = v; });

function bindFill(node, varName) {
  const v = varByName[varName];
  if (!v || !node.fills?.length) return;
  // Use inline boundVariables assignment — works on ComponentNodes inside a ComponentSet
  // (post-combineAsVariants) where figma.variables.setBoundVariableForPaint throws TypeError.
  node.fills = node.fills.map((f, i) => i === 0
    ? { ...f, boundVariables: { color: { type: 'VARIABLE_ALIAS', id: v.id } } }
    : f);
}

function bindStroke(node, varName) {
  const v = varByName[varName];
  if (!v || !node.strokes?.length) return;
  node.strokes = node.strokes.map((s, i) => i === 0
    ? { ...s, boundVariables: { color: { type: 'VARIABLE_ALIAS', id: v.id } } }
    : s);
}

function bindNum(node, prop, varName) {
  const v = varByName[varName]; if (!v) return;
  node.setBoundVariable(prop, v);
}

function bindRadius(node, varName) {
  const v = varByName[varName]; if (!v) return;
  ['topLeftRadius','topRightRadius','bottomLeftRadius','bottomRightRadius']
    .forEach(p => node.setBoundVariable(p, v));
}

function bindEffect(node, effectIndex, field, varName) {
  // field: 'color' | 'radius' | 'spread' | 'offsetX' | 'offsetY'
  // Bind each field in a separate call — multiple bindings on the same effect
  // must be chained (each call returns the updated effect; use that as input to next call)
  const v = varByName[varName]; if (!v) return false;
  const clone = node.effects.map(e => ({ ...e }));
  clone[effectIndex] = figma.variables.setBoundVariableForEffect(clone[effectIndex], field, v);
  node.effects = clone;
  return true;
}

function bindStrokeWeight(node, varName) {
  const v = varByName[varName]; if (!v) return;
  if (node.type === 'TEXT') {
    node.setBoundVariable('strokeWeight', v);
  } else {
    ['strokeTopWeight','strokeBottomWeight','strokeLeftWeight','strokeRightWeight']
      .forEach(p => node.setBoundVariable(p, v));
  }
}
