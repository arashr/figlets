// Read absolute bounding boxes for all named child nodes of a component.
// Substitute 'ComponentName' with the actual component name before running.
// Returns JSON: { compW, compH, compBounds, elements[] }

const comp = figma.currentPage.findOne(n =>
  (n.type === 'COMPONENT' || n.type === 'COMPONENT_SET') && n.name === 'ComponentName');

// For ComponentSet, use the first (default) variant
const target = comp.type === 'COMPONENT_SET'
  ? comp.children.find(c => c.name.includes('Default') || c.name.includes('Full')) || comp.children[0]
  : comp;

const compBounds = target.absoluteBoundingBox;

// Collect all named, non-instance leaf areas
const elements = [];
function collectElements(node, depth = 0) {
  if (!node.absoluteBoundingBox) return;
  const nb = node.absoluteBoundingBox;
  elements.push({
    name: node.name,
    type: node.type,
    depth,
    x: Math.round(nb.x - compBounds.x),
    y: Math.round(nb.y - compBounds.y),
    w: Math.round(nb.width),
    h: Math.round(nb.height),
  });
  if ('children' in node && node.type !== 'INSTANCE') {
    node.children.forEach(c => collectElements(c, depth + 1));
  }
}
collectElements(target);
return JSON.stringify({ compW: target.width, compH: target.height, compBounds, elements });
