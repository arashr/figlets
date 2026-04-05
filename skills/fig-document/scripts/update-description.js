// Prepend [SPEC] machine-readable block to the component's Figma description.
// Substitute before running:
//   compName         — component name string (e.g. 'Button')
//   variantDimensions — e.g. 'Layout=Horizontal|Vertical, Emphasis=Full|Minimal'
//   propList         — e.g. 'label (TEXT), showIcon (BOOLEAN), size (TEXT)'
//   tokenSummary     — e.g. 'bg=paper, title=ink-black, padding=2xl, fontSize=body'
//   a11ySummary      — e.g. 'title:16.6:1✓, secondary:3.9:1⚠'

const specBlock = `[SPEC]
component: ${compName}
variants: ${variantDimensions}
properties: ${propList}
tokens: ${tokenSummary}
a11y: ${a11ySummary}
spec-file: component-specs/${compName}.md
[/SPEC]

`;

const comp = figma.currentPage.findOne(n =>
  n.name === compName && (n.type === 'COMPONENT' || n.type === 'COMPONENT_SET'));
if (comp) {
  const existing = comp.description || '';
  // Replace existing [SPEC] block if present, otherwise prepend
  const cleaned = existing.replace(/\[SPEC\][\s\S]*?\[\/SPEC\]\n*/g, '');
  comp.description = specBlock + cleaned;
}
