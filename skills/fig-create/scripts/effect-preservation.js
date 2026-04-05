// Effect preservation — read source effects and match to local Effect Styles.
// Run via use_figma before building the component.
// Returns: { matchedStyleId, hasSourceEffects, sourceEffects }

const srcNode = figma.currentPage.selection[0];
const sourceEffects = srcNode?.effects ? JSON.parse(JSON.stringify(srcNode.effects)) : [];

// 1. Check if any elevation Effect Style matches the source shadow
const effectStyles = figma.getLocalEffectStyles();
let matchedStyleId = null;
if (sourceEffects.length > 0 && effectStyles.length > 0) {
  const srcShadow = sourceEffects.find(e => e.type === 'DROP_SHADOW');
  if (srcShadow) {
    const match = effectStyles.find(s => {
      const se = s.effects.find(e => e.type === 'DROP_SHADOW');
      return se && Math.abs(se.radius - srcShadow.radius) <= 2
                && Math.abs(se.offset.y - srcShadow.offset.y) <= 2;
    });
    if (match) matchedStyleId = match.id;
  }
}

// After building comp — apply effects:
// if (matchedStyleId) {
//   comp.effectStyleId = matchedStyleId;   // preferred: use the system's Effect Style
// } else if (sourceEffects.length > 0) {
//   comp.effects = sourceEffects;          // fallback: preserve raw effects
//   // Then attempt to bind each property to elevation variables by value match
//   // using bindEffect helper (from shared/bind-helpers.js)
// }
// Priority: Effect Style match → raw preservation with variable binding → no effect.

return { matchedStyleId, hasSourceEffects: sourceEffects.length > 0, sourceEffects };
