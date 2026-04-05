// Variant wiring — combineAsVariants setup, interaction wiring, and focus ring.
// Substitute component name/version in set.name before running.

// ── PRE-COMBINE: Apply focus ring to the Focus state variant ──────────────────

const FOCUS_RING = [
  { type:'DROP_SHADOW', color:{r:0,g:0.42,b:0.88,a:1}, offset:{x:0,y:0}, radius:0, spread:4, visible:true, blendMode:'NORMAL' },
  { type:'DROP_SHADOW', color:{r:1,g:1,b:1,a:1},       offset:{x:0,y:0}, radius:0, spread:2, visible:true, blendMode:'NORMAL' }
];
// REQUIRED: set clipsContent = true on the component for spread shadows to render.
// Without it Figma hides the shadow entirely.
focusVariant.clipsContent = true;
focusVariant.effects = FOCUS_RING;

// ── POST-COMBINE: combineAsVariants + reaction wiring ────────────────────────

// Pre-position before combining
const variants = [defaultComp, hoverComp, focusComp, activeComp, disabledComp];
variants.forEach((v, i) => { v.x = i * 400; v.y = -30000; pg.appendChild(v); });

const set = figma.combineAsVariants(variants, pg);
set.name = 'ComponentName 1.0.0'; // always include X.Y.Z — new = 1.0.0, update = bump per rule
set.layoutMode = 'HORIZONTAL'; set.layoutWrap = 'WRAP';
set.primaryAxisSizingMode = 'AUTO'; set.counterAxisSizingMode = 'AUTO';
set.itemSpacing = 8; set.paddingTop = 20; set.paddingBottom = 20;
set.paddingLeft = 20; set.paddingRight = 20;
try { set.counterAxisSpacing = 8; } catch(e) {}

// Wire interactions after combining
async function rxAdd(set, list) {
  for (const { from, to, trigger } of list) {
    const src = set.children.find(n => n.name.includes(from));
    const dst = set.children.find(n => n.name.includes(to));
    if (!src || !dst) continue;
    await src.setReactionsAsync([...(src.reactions || []), {
      actions: [{ type: 'NODE', destinationId: dst.id, navigation: 'CHANGE_TO',
                  transition: null, preserveScrollPosition: false }],
      trigger: { type: trigger }
    }]);
  }
}

await rxAdd(set, [
  { from: 'Default', to: 'Hover',   trigger: 'ON_HOVER' },
  // Note: MOUSE_LEAVE is NOT a valid Figma trigger — ON_HOVER auto-returns when mouse leaves.
  // Do NOT add a MOUSE_LEAVE reaction. Figma handles the return automatically.
  { from: 'Default', to: 'Active',  trigger: 'ON_PRESS' },
  { from: 'Default', to: 'Focus',   trigger: 'ON_CLICK' },
]);
