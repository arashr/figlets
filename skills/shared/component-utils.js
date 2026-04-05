// Shared component lookup utilities. Use these functions to locate and inspect existing components.

/**
 * findComponentByName(baseName)
 * Searches the current page for a component or component set matching baseName
 * exactly or with a version suffix (e.g. "Button 1.2.0").
 */
function findComponentByName(baseName) {
  return figma.currentPage.findOne(n =>
    (n.name === baseName || n.name.match(new RegExp(`^${baseName} \\d+\\.\\d+\\.\\d+$`))) &&
    (n.type === 'COMPONENT' || n.type === 'COMPONENT_SET')
  );
}

/**
 * getComponentMeta(baseName)
 * Returns metadata about an existing component:
 * { exists, type, currentName, currentVersion, variantNames, propDefs }
 */
function getComponentMeta(baseName) {
  const set = findComponentByName(baseName);
  const vMatch = set?.name.match(/(\d+\.\d+\.\d+)$/);
  return {
    exists: !!set,
    type: set?.type,
    currentName: set?.name,
    currentVersion: vMatch?.[1] || '(unversioned)',
    variantNames: set?.children?.map(c => c.name),
    propDefs: set?.componentPropertyDefinitions,
  };
}

/**
 * findDefaultVariant(compSet)
 * Returns the Default or Full variant of a ComponentSet, or the first child.
 */
function findDefaultVariant(compSet) {
  return compSet.children.find(c => c.name.includes('Default') || c.name.includes('Full'))
    || compSet.children[0];
}
