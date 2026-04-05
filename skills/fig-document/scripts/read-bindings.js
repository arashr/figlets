// Collect all design token bindings on the default variant.
// Set `target` to the default variant node before running (from Step 2).
// Returns JSON: [{ node, property, token }]

function collectBindings(node, bindings = []) {
  if (node.type === 'INSTANCE') return bindings;

  async function getVarName(id) {
    const v = await figma.variables.getVariableByIdAsync(id);
    return v ? v.name : id;
  }

  const bv = node.boundVariables || {};
  const checks = [
    ['fills',    'Fill'],
    ['strokes',  'Stroke'],
    ['paddingTop', 'paddingTop'], ['paddingBottom','paddingBottom'],
    ['paddingLeft','paddingLeft'], ['paddingRight','paddingRight'],
    ['itemSpacing','itemSpacing'], ['counterAxisSpacing','counterAxisSpacing'],
    ['fontSize','fontSize'], ['topLeftRadius','cornerRadius'],
    ['strokeTopWeight','strokeWeight'],
  ];

  for (const [key, label] of checks) {
    if (bv[key]) {
      const entry = Array.isArray(bv[key]) ? bv[key][0] : bv[key];
      if (entry?.id) {
        bindings.push({ node: node.name, property: label, varId: entry.id });
      }
    }
  }

  if ('children' in node) node.children.forEach(c => collectBindings(c, bindings));
  return bindings;
}

const raw = collectBindings(target);
// Resolve variable names
const resolved = [];
for (const b of raw) {
  const v = await figma.variables.getVariableByIdAsync(b.varId);
  resolved.push({ node: b.node, property: b.property, token: v ? v.name : b.varId });
}
return JSON.stringify(resolved);
