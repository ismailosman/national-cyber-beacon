

## Add Cavalier Infostealer Intelligence + Usernames Field to Dark Web Monitor

### Overview
Add Hudson Rock Cavalier infostealer findings as a new collapsible section in the results area, add a "Usernames" chip input to the scan form, and update the API call and types to support both.

### Changes

**1. `src/types/darkweb.ts`**
- Add `cavalier?: DarkWebSourceResult` to the `DarkWebResults` interface
- Add `usernames` to `DarkWebScanRequest`

**2. `src/services/darkwebApi.ts`**
- Add `usernames: string[]` parameter to `startDarkWebScan`
- Pass `usernames` in the POST body to `/darkweb/scan`

**3. `src/pages/DarkWebMonitor.tsx`**
- **Usernames chip input**: Add a new state `usernames` as `string[]` with chip/tag behavior (type + Enter/comma to add, click X to remove) -- same visual style as the existing form fields but with removable chips
- Pass `usernames` array to `startDarkWebScan`
- **Cavalier section**: After the existing tabbed results card, add a new collapsible section:
  - Header: "Infostealer Intelligence (Hudson Rock)" with finding count badge
  - Uses Collapsible component from `@radix-ui/react-collapsible`
  - Each finding rendered as a card with:
    - Left border: red for CRITICAL, orange for HIGH
    - Stealer name in a red pill badge (e.g., "RedLine Stealer")
    - Infected machine name, OS, date uploaded
    - Severity badge (CRITICAL/HIGH)
    - Credentials list: URL shown, password masked as "••••••••"
  - If 0 findings: green "No infostealer infections detected" message
- **Summary stats**: When computing summary totals for the stat cards, add cavalier findings count to the total. The summary comes from the API (`darkweb_summary`), but we augment the displayed total by also counting cavalier findings if the summary doesn't already include them

### Layout of Cavalier Section

```text
+-------------------------------------------------------+
| [v] Infostealer Intelligence (Hudson Rock)  [3 found] |
+-------------------------------------------------------+
| +---------------------------------------------------+ |
| | [RED BORDER] RedLine Stealer                      | |
| | Machine: DESKTOP-ABC  |  OS: Windows 10           | |
| | Uploaded: 2024-01-15                               | |
| | Severity: [CRITICAL]                               | |
| | Credentials:                                       | |
| |   - https://example.com  |  pass: ••••••••        | |
| +---------------------------------------------------+ |
| +---------------------------------------------------+ |
| | [ORANGE BORDER] Raccoon                           | |
| | Machine: LAPTOP-XYZ  |  OS: Windows 11            | |
| | ...                                                | |
| +---------------------------------------------------+ |
+-------------------------------------------------------+
```

### Files Modified
- `src/types/darkweb.ts` -- add `cavalier` to results, `usernames` to request
- `src/services/darkwebApi.ts` -- add `usernames` param
- `src/pages/DarkWebMonitor.tsx` -- add usernames chip input, cavalier collapsible section, augmented summary stats

