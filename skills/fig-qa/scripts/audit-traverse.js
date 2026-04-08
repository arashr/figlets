// Requires detect-ds-context.js pasted above (provides DS_CONTEXT).
// Returns JSON: { typographyStrategy, violations[] }

function auditNode(node) {
  if (node.type === 'INSTANCE') return [];
  const violations = [];
  const name = node.name;

  // Fills
  if (node.fills && Array.isArray(node.fills)) {
    node.fills.forEach((fill, i) => {
      if (fill.type === 'SOLID' && !node.boundVariables?.fills?.[i]) {
        const r = Math.round(fill.color.r * 255);
        const g = Math.round(fill.color.g * 255);
        const b = Math.round(fill.color.b * 255);
        violations.push({ nodeId: node.id, nodeName: name, nodeType: node.type, fillIndex: i,
          property: 'Fill color', rawValue: `rgb(${r},${g},${b})`, type: 'color' });
      }
    });
  }

  // Strokes
  if (node.strokes && Array.isArray(node.strokes)) {
    node.strokes.forEach((s, i) => {
      if (s.type === 'SOLID' && !node.boundVariables?.strokes?.[i]) {
        const r = Math.round(s.color.r * 255);
        const g = Math.round(s.color.g * 255);
        const b = Math.round(s.color.b * 255);
        violations.push({ nodeId: node.id, nodeName: name, nodeType: node.type, strokeIndex: i,
          property: 'Stroke color', rawValue: `rgb(${r},${g},${b})`, type: 'color' });
      }
    });
  }

  // Stroke weight — only flag if node actually has strokes
  if (node.strokes?.length > 0 && node.strokeWeight && node.strokeWeight !== 0) {
    const swBound = node.type === 'TEXT'
      ? node.boundVariables?.strokeWeight
      : node.boundVariables?.strokeTopWeight;
    if (!swBound) violations.push({ nodeId: node.id, nodeName: name, nodeType: node.type,
      property: 'Stroke weight', rawValue: `${node.strokeWeight}px`, type: 'border' });
  }

  // Corner radius
  if (node.type !== 'TEXT' && typeof node.cornerRadius === 'number' && node.cornerRadius !== 0) {
    if (!node.boundVariables?.topLeftRadius) {
      violations.push({ nodeId: node.id, nodeName: name, nodeType: node.type,
        property: 'Corner radius', rawValue: `${node.cornerRadius}px`, type: 'border' });
    }
  }

  // Auto-layout spacing
  if (node.layoutMode && node.layoutMode !== 'NONE') {
    ['paddingTop','paddingBottom','paddingLeft','paddingRight','itemSpacing','counterAxisSpacing'].forEach(prop => {
      if (node[prop] && node[prop] !== 0 && !node.boundVariables?.[prop]) {
        violations.push({ nodeId: node.id, nodeName: name, nodeType: node.type,
          property: prop, rawValue: `${node[prop]}px`, type: 'spacing' });
      }
    });
  }

  // Typography — strategy driven by DS_CONTEXT.typographyStrategy:
  //   'text-styles' → require textStyleId (bundles all properties)
  //   'variables'   → require boundVariables.fontSize (variable-only DS)
  //   'none'        → flag if fontSize is raw (no tokens available to suggest)
  if (node.type === 'TEXT') {
    const strat = DS_CONTEXT.typographyStrategy;
    if (strat === 'text-styles') {
      if (!node.textStyleId) {
        const fs = node.fontSize !== figma.mixed ? `${node.fontSize}px` : 'mixed';
        violations.push({ nodeId: node.id, nodeName: name, nodeType: node.type,
          property: 'Text style', rawValue: fs, type: 'typography' });
      }
    } else if (strat === 'variables') {
      if (node.fontSize !== figma.mixed && !node.boundVariables?.fontSize) {
        violations.push({ nodeId: node.id, nodeName: name, nodeType: node.type,
          property: 'Font size', rawValue: `${node.fontSize}px`, type: 'typography' });
      }
    } else {
      // No tokens at all — flag as raw if unbound, for user awareness
      if (node.fontSize !== figma.mixed && !node.textStyleId && !node.boundVariables?.fontSize) {
        violations.push({ nodeId: node.id, nodeName: name, nodeType: node.type,
          property: 'Font size', rawValue: `${node.fontSize}px`, type: 'typography',
          note: 'No text styles or typography variables found in this file' });
      }
    }
  }

  if ('children' in node) node.children.forEach(c => violations.push(...auditNode(c)));
  return violations;
}

const scope = figma.currentPage.selection.length > 0
  ? figma.currentPage.selection
  : figma.currentPage.children;

const allViolations = [];
scope.forEach(node => allViolations.push(...auditNode(node)));
// Return typographyStrategy so the AI knows which fix path to take
return JSON.stringify({ typographyStrategy: DS_CONTEXT.typographyStrategy, violations: allViolations });
