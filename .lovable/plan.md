

## Add Kaspersky Feed Tab to Global Threat Map

### Changes to `src/pages/ThreatMapStandalone.tsx`

**1. Add tab state** (after existing state declarations, ~line 35):
- Add `const [activeTab, setActiveTab] = useState<'map' | 'kaspersky'>('map');`

**2. Add tab buttons in the header** (after the logo/title div, before the controls div, ~line 158):
- Insert two tab buttons styled with the existing dark theme:
  - "Live Map" tab (active by default) with cyan bottom border when active
  - "Kaspersky Feed" tab
- Styled as inline buttons with `font-mono`, matching the page's dark aesthetic

**3. Wrap existing body in conditional** (~lines 191-439):
- When `activeTab === 'map'`: render all existing content (left panel, map engine, right panel, mobile panel) -- zero changes to existing markup
- When `activeTab === 'kaspersky'`: render a new full-width panel containing:
  - Heading with shield emoji: "Kaspersky Global Threat Intelligence Feed"
  - Subtitle: "Live data from Kaspersky Security Network (KSN)"
  - The iframe embed: `https://cybermap.kaspersky.com/en/widget/dynamic/dark` at 100% width, filling available viewport height
  - Dark background (`#0a0a14`) matching the existing page

### What stays the same
- All existing map functionality, arc queue, sidebars, mobile panel -- completely untouched
- No new files or dependencies
- Single file change only
