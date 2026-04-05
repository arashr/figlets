// Shared section helper. Use findOrCreateSection to place content inside named Sections.

/**
 * findOrCreateSection(name)
 * Finds an existing Section by name on the current page, or creates one at (0, 0).
 */
function findOrCreateSection(name) {
  let section = figma.currentPage.findOne(n => n.type === 'SECTION' && n.name === name);
  if (!section) {
    section = figma.createSection();
    section.name = name;
    section.x = 0; section.y = 0;
    figma.currentPage.appendChild(section);
  }
  return section;
}
