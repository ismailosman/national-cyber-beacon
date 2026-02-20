

## Plan: Make CIS Controls Clickable with Requirements and Recommendations

### Problem
The compliance table rows are not interactive. When running CIS compliance assessments, users cannot see what each control requires or recommends. The `description` column in the database is empty for all controls.

### Solution
Make each control row clickable to expand and show detailed requirements and recommendations inline. Since the database `description` field is null for all controls, we will embed CIS Controls v8 requirement/recommendation text as a static dictionary in the component.

---

### Changes

#### 1. Add CIS Controls Reference Data (src/pages/Compliance.tsx)

Add a static `CIS_CONTROL_DETAILS` dictionary near the top of the file containing requirements and recommendations for all 20 CIS controls. Example entries:

- **CIS-1.1**: "Establish and maintain an accurate, detailed, and up-to-date inventory of all enterprise assets..." with recommendations like "Use automated tools for asset discovery" and "Update inventory weekly"
- **CIS-4.1**: "Establish and maintain a secure configuration process for enterprise assets..." with recommendations for hardening baselines
- All 20 controls will have entries with `requirements` (string) and `recommendations` (string array)

#### 2. Make Rows Expandable (src/pages/Compliance.tsx)

- Add a `expandedControl` state (string or null) to track which row is expanded
- Make each table row clickable with a cursor pointer and a chevron indicator
- When clicked, toggle an expanded detail panel below the row showing:
  - **Requirements**: Full description of what the control requires
  - **Recommendations**: Bulleted list of actionable steps
  - If an assessment exists, also show the **Evidence** details in the expanded view
- Style the expanded section with a slightly different background to distinguish it from the table

#### 3. Visual Indicators

- Add a small chevron icon (ChevronDown/ChevronRight) in the Code column to indicate expandability
- Highlight the expanded row with a subtle border accent
- The expanded panel will have a clean two-column layout: Requirements on the left, Recommendations on the right (stacked on mobile)

---

### Technical Details

| File | Changes |
|---|---|
| `src/pages/Compliance.tsx` | Add `CIS_CONTROL_DETAILS` dictionary (~20 entries), add `expandedControl` state, make `<tr>` clickable with `onClick` toggle, render conditional expanded row with requirements/recommendations |

No database changes needed -- all reference data is embedded in the component.
