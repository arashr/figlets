// Find component and return metadata.
// Substitute 'ComponentName' with the actual component name before running.

const comp = figma.currentPage.findOne(n =>
  (n.type === 'COMPONENT' || n.type === 'COMPONENT_SET') && n.name === 'ComponentName');
return {
  id: comp.id,
  type: comp.type,
  width: comp.width,
  height: comp.height,
  variantCount: comp.type === 'COMPONENT_SET' ? comp.children.length : 1,
  variants: comp.type === 'COMPONENT_SET' ? comp.children.map(c => c.name) : [comp.name],
  componentPropertyDefinitions: comp.componentPropertyDefinitions,
  description: comp.description
};
