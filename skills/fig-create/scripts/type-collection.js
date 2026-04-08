// Variable mode pattern for Type dimension.
// Substitute collection name, mode names, and variable values for the component being built.
// Run via use_figma after the component variants are built.

// ⚠️  ASYNC RULE — always use the Async variants. The synchronous versions are deprecated
//     and will throw in some Figma plugin contexts:
//       figma.variables.getLocalVariablesAsync()           ✓
//       figma.variables.getLocalVariableCollectionsAsync() ✓
//       figma.variables.getLocalVariables()                ✗  — NEVER use
//       figma.variables.getLocalVariableCollections()      ✗  — NEVER use
// This applies to every getOrCreateVar helper or size-collection script derived from this file.

// 1. Create a variable collection for the type dimension
const colls = await figma.variables.getLocalVariableCollectionsAsync();
let typeColl = colls.find(c => c.name === 'Button · Type');
if (!typeColl) {
  typeColl = figma.variables.createVariableCollection('Button · Type');
  typeColl.renameMode(typeColl.modes[0].modeId, 'Primary');
}
const primaryMode   = typeColl.modes[0].modeId;
const secondaryMode = typeColl.addMode('Secondary');
const ghostMode     = typeColl.addMode('Ghost');
const dangerMode    = typeColl.addMode('Danger');

// 2. Create one variable per property that changes across types
const bgVar = figma.variables.createVariable('button/bg', typeColl, 'COLOR');
bgVar.setValueForMode(primaryMode,   { r: 0.071, g: 0.071, b: 0.078, a: 1 }); // ink-black
bgVar.setValueForMode(secondaryMode, { r: 0.961, g: 0.941, b: 0.922, a: 1 }); // paper
bgVar.setValueForMode(ghostMode,     { r: 0, g: 0, b: 0, a: 0 });             // transparent
bgVar.setValueForMode(dangerMode,    { r: 0.863, g: 0.133, b: 0.0, a: 1 });   // overprint-red

// (repeat for fgVar, strokeVar, hasBorderVar, etc.)

// 3. Bind type variables to each STATE variant — identical binding in all 5
for (const variant of set.children) {
  const fills = [{ type: 'SOLID', color: { r: 0.071, g: 0.071, b: 0.078 } }];
  const f = figma.variables.setBoundVariableForPaint(fills[0], 'color', bgVar);
  variant.fills = [f];
  // bind text, stroke, etc. similarly
}

// 4. When instantiating, callers set the mode to choose the type:
// instance.setExplicitVariableModeForCollection(typeColl, secondaryMode);

// In consuming code or when placing the component:
// const inst = buttonVariant.createInstance();
// inst.setExplicitVariableModeForCollection(typeColl, ghostMode); // → Ghost type
