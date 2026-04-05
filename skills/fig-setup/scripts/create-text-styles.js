// Create all 15 Figma Text Styles bound to Typography variables.
// Requires the Typography variable collection to already exist in the file.

const allVars = await figma.variables.getLocalVariablesAsync();
const findVar = (name) => allVars.find(v => v.name === name);

const roles = [
  { name: 'type/display/lg',   family: 'sans' },
  { name: 'type/display/md',   family: 'sans' },
  { name: 'type/display/sm',   family: 'sans' },
  { name: 'type/headline/lg',  family: 'sans' },
  { name: 'type/headline/md',  family: 'sans' },
  { name: 'type/headline/sm',  family: 'sans' },
  { name: 'type/title/lg',     family: 'sans' },
  { name: 'type/title/md',     family: 'sans' },
  { name: 'type/title/sm',     family: 'sans' },
  { name: 'type/body/lg',      family: 'sans' },
  { name: 'type/body/md',      family: 'sans' },
  { name: 'type/body/sm',      family: 'sans' },
  { name: 'type/label/lg',     family: 'sans' },
  { name: 'type/label/md',     family: 'sans' },
  { name: 'type/label/sm',     family: 'sans' },
];

for (const role of roles) {
  const style = figma.createTextStyle();
  style.name = role.name;
  const sizeVar    = findVar(`${role.name}/size`);
  const lhVar      = findVar(`${role.name}/line-height`);
  const trackVar   = findVar(`${role.name}/tracking`);
  const weightVar  = findVar(`${role.name}/weight`);
  const familyVar  = findVar(`type/family/${role.family}`);
  if (sizeVar)   await style.setBoundVariable('fontSize',      sizeVar);
  if (lhVar)     await style.setBoundVariable('lineHeight',    lhVar);
  if (trackVar)  await style.setBoundVariable('letterSpacing', trackVar);
  if (weightVar) await style.setBoundVariable('fontStyle',     weightVar);
  if (familyVar) await style.setBoundVariable('fontFamily',    familyVar);
}
