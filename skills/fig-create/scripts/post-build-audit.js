// Post-build self-audit. Run on the ComponentSet (`set`) after combineAsVariants.
// Returns an array of violation objects to fix using the bind helpers before taking a screenshot.

function quickAudit(node, violations = []) {
  if (node.type === 'INSTANCE') return violations;
  // Strokes with unbound color
  (node.strokes || []).forEach((s, i) => {
    if (s.type === 'SOLID' && !node.boundVariables?.strokes?.[i])
      violations.push({ nodeId: node.id, type: node.type, prop: 'Stroke color', strokeIndex: i,
        hex: '#'+['r','g','b'].map(c=>Math.round(s.color[c]*255).toString(16).padStart(2,'0')).join('') });
  });
  // Stroke weight on stroked nodes
  if ((node.strokes||[]).length > 0 && node.strokeWeight && !node.boundVariables?.strokeTopWeight && !node.boundVariables?.strokeWeight)
    violations.push({ nodeId: node.id, type: node.type, prop: 'Stroke weight', value: node.strokeWeight });
  // Corner radius
  if (node.type !== 'TEXT' && node.cornerRadius > 0 && !node.boundVariables?.topLeftRadius)
    violations.push({ nodeId: node.id, type: node.type, prop: 'Corner radius', value: node.cornerRadius });
  // Spacing
  if (node.layoutMode && node.layoutMode !== 'NONE') {
    ['paddingTop','paddingBottom','paddingLeft','paddingRight','itemSpacing','counterAxisSpacing'].forEach(p => {
      if (node[p] && !node.boundVariables?.[p])
        violations.push({ nodeId: node.id, type: node.type, prop: p, value: node[p] });
    });
  }
  if ('children' in node) node.children.forEach(c => quickAudit(c, violations));
  return violations;
}

// Run on the full ComponentSet after build, fix silently, report count
const remaining = quickAudit(set);
// fix each remaining violation using the same bind helpers before screenshot
