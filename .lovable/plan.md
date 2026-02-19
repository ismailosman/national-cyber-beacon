
# Logo Replacement + Add Banks & Telecoms + Organization Edit Button

## Overview

Three changes will be made simultaneously:

1. Replace the text logo in the sidebar with the uploaded image
2. Insert 15 new organizations (8 banks + 7 telecoms) into the database with their assets
3. Add an Edit Organization modal/dialog to the OrgDetail page

---

## 1. Logo Replacement

**Files to change:** `src/components/layout/Sidebar.tsx` and `src/components/layout/AppLayout.tsx`

The uploaded logo (`user-uploads://image.png`) will be copied to `src/assets/logo.png`.

- **Sidebar**: Remove the `Shield` icon + "Somalia / Cyber Defense" text block. Replace with `<img src={logoImg} />` — sized `w-36` to show the full logo in the sidebar header area.
- **Mobile header (AppLayout)**: Replace the text `"Somalia Cyber Defense"` with the same logo image.

---

## 2. Add Banks & Telecoms to Database

**Method:** Database insert (data operation, no schema change needed)

The following new organizations will be inserted. All existing banks (Premier Bank, Salaam Bank, Central Bank) are kept — only missing ones are added:

**Banks (8 new):**

| Name | Domain | Region |
|---|---|---|
| International Bank of Somalia (IBS) | ibsbank.so | Banaadir |
| Dahabshiil International Bank | dahabshilbank.com | Banaadir |
| Amal Bank | amalbankso.so | Banaadir |
| Amana Bank | amanabank.so | Banaadir |
| Daryeel Bank | daryeelbank.com | Banaadir |
| MyBank Limited | mybank.so | Banaadir |
| SomBank | sombank.so | Banaadir |
| Agro Africa Bank | agrobank.so | Banaadir |

**Telecoms (7 new):**

| Name | Domain | Region |
|---|---|---|
| Hormuud Telecom | hormuud.com | Banaadir |
| Somtel | somtel.com | Puntland |
| NationLink Telecom | nationlinktelecom.net | Banaadir |
| Golis Telecom | golistelecom.com | Puntland |
| Telesom | telesom.com | Somaliland |
| Telcom Somalia | telcom-somalia.com | Banaadir |
| SomLink | somlink.so | Banaadir |

Each organization will also get one website asset inserted into the `assets` table.

**Also fix:** The `Organizations` page filter currently only shows `All | Government | Bank` — it will be updated to include `Telecom` as a filter tab since we're adding telecom organizations.

---

## 3. Edit Organization Button

**File to change:** `src/pages/OrgDetail.tsx`

An **Edit** button will be added next to the "Run Scan Now" button in the org detail header. Clicking it opens a modal dialog (using the existing `Dialog` component from `src/components/ui/dialog.tsx`) with a form to edit:

- Organization name
- Domain
- Region
- Contact email
- Sector
- Status

On save, the form calls `supabase.from('organizations').update(...)` and refreshes the page data. A success toast is shown. The edit button will only be visible based on role — SuperAdmin and OrgAdmin can edit.

---

## Technical Notes

- The `sector` column in `organizations` uses a Postgres enum `sector_type` which already includes `'telecom'` — no migration needed.
- The filter tabs on the Organizations page will be extended from `['All', 'Government', 'Bank']` to `['All', 'Government', 'Bank', 'Telecom']` and the type updated accordingly.
- The edit form will match on `sector` values that map to the existing enum values (`government`, `bank`, `telecom`, `health`, `education`, `other`).
- RLS policies already allow SuperAdmin full access and OrgAdmin update on own org — the edit functionality is already protected at the database level.
