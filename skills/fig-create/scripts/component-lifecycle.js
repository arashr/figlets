// Component lifecycle patterns reference — adapt variable names and values for the specific component being built.
// Covers: detect/inspect, update existing variant, add missing variant,
// reduce variant count, and instance migration (full structural rebuild).

// ── DETECT / INSPECT ─────────────────────────────────────────────────────────

// Search by base name (with or without existing version suffix)
const baseName = 'ComponentName';
const set = figma.currentPage.findOne(n =>
  (n.name === baseName || n.name.match(new RegExp(`^${baseName} \\d+\\.\\d+\\.\\d+$`))) &&
  (n.type === 'COMPONENT' || n.type === 'COMPONENT_SET'));

const vMatch = set?.name.match(/(\d+\.\d+\.\d+)$/);
return {
  exists: !!set,
  type: set?.type,
  currentName: set?.name,
  currentVersion: vMatch?.[1] || '(unversioned)',
  variantNames: set?.children?.map(c => c.name),
  propDefs: set?.componentPropertyDefinitions,
};

// ── MODIFY EXISTING VARIANT ───────────────────────────────────────────────────

// Modify properties on an existing variant directly
const variant = set.children.find(n => n.name === 'Type=Primary, State=Default');
if (variant) {
  variant.paddingTop = 16;
  variant.setBoundVariable('paddingTop', mdVar);

  // Add a new child (e.g. icon frame) if missing
  if (!variant.findOne(n => n.name === 'icon')) {
    const iconF = figma.createFrame();
    iconF.name = 'icon';
    // ... configure ...
    variant.insertChild(0, iconF); // insert before label
  }

  // Add a missing component property
  if (!variant.componentPropertyDefinitions['label']) {
    variant.addComponentProperty('label', 'TEXT', 'Button');
  }
}

// After applying all changes, update the version suffix in-place:
// set.name = 'ComponentName 1.1.0';

// ── ADD MISSING VARIANT TO EXISTING COMPONENTSET ─────────────────────────────

// Create the new variant component
const newVariant = figma.createComponent();
newVariant.name = 'Type=Primary, State=Focus';
// ... configure layout, fills, children ...

// Position it temporarily, then append to the existing set
newVariant.x = -99999; newVariant.y = -99999;
figma.currentPage.appendChild(newVariant);

// Append to the existing ComponentSet — no combineAsVariants needed
set.appendChild(newVariant);

// ── REDUCE VARIANT COUNT ──────────────────────────────────────────────────────

// NEVER create a new ComponentSet and delete the old one — this changes the node ID
// and breaks all instances. Remove unwanted child variants in-place instead.

// Keep only one type's state variants, remove the rest
const buttonSet = figma.currentPage.findOne(n => n.name === 'Button' && n.type === 'COMPONENT_SET');
for (const v of [...buttonSet.children]) {
  if (!v.name.includes('Type=Primary')) v.remove(); // remove non-primary
}
// Rename: "Type=Primary, State=Default" → "State=Default"
for (const v of buttonSet.children) {
  v.name = v.name.replace('Type=Primary, ', '');
}
// Now bind new type variables to the remaining variants
// ComponentSet node ID is unchanged — all instances stay valid

// ── INSTANCE SCAN + SWAP + DELETE (full structural rebuild only) ──────────────
// Use only when changing from COMPONENT to COMPONENT_SET or completely different
// layer hierarchy. Prefer in-place updates whenever possible.

await figma.loadAllPagesAsync();
const toMigrate = [];
for (const page of figma.root.children) {
  for (const inst of page.findAll(n => n.type === 'INSTANCE')) {
    const main = await inst.getMainComponentAsync();
    if (main && (main.id === oldComp.id || main.parent?.id === oldComp.id)) {
      toMigrate.push(inst);
    }
  }
}
// Swap then delete
for (const inst of toMigrate) inst.swapComponent(newSet.defaultVariant || newSet.children[0]);
oldComp.remove();
