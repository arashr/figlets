// Collect all raw (unbound) fill colors and float values from the source node.
// Returns JSON: { colors: string[], floats: number[] }

function collectValues(node, results = { colors: new Set(), floats: new Set() }) {
  if (node.type === 'INSTANCE') return results;

  if (node.fills) node.fills.forEach(f => {
    if (f.type === 'SOLID' && !node.boundVariables?.fills?.[0]) {
      const hex = '#' + [f.color.r, f.color.g, f.color.b]
        .map(c => Math.round(c*255).toString(16).padStart(2,'0')).join('');
      results.colors.add(hex);
    }
  });

  ['paddingTop','paddingBottom','paddingLeft','paddingRight','itemSpacing',
   'counterAxisSpacing','fontSize','cornerRadius'].forEach(prop => {
    const val = node[prop];
    if (val && typeof val === 'number' && val !== 0 && !node.boundVariables?.[prop]) {
      results.floats.add(val);
    }
  });

  if ('children' in node) node.children.forEach(c => collectValues(c, results));
  return results;
}

const src = figma.currentPage.selection[0] || figma.currentPage.children[0];
const vals = collectValues(src);
return JSON.stringify({ colors: [...vals.colors], floats: [...vals.floats] });
