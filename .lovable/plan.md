
# Three Changes in One Pass

## Summary of Work

1. **Replace the logo** — copy the newly uploaded image to `src/assets/logo.png` (replaces the existing one, both Sidebar and AppLayout automatically pick it up since they already import from that path)
2. **Delete Organization** — add a red "Delete" button on the OrgDetail page, visible only to SuperAdmin, that opens an `AlertDialog` confirmation before calling `supabase.from('organizations').delete()` and navigating back
3. **Add Organization** — add an "Add Organization" button on the Organizations page header (visible to SuperAdmin only) that opens a `Dialog` modal with a full creation form

---

## 1. Logo Replacement

**File operation:** `lov-copy user-uploads://D0473B6E-F138-4642-839B-4104AE36A62A.png src/assets/logo.png`

No code changes needed — both `src/components/layout/Sidebar.tsx` and `src/components/layout/AppLayout.tsx` already import `logoImg from '@/assets/logo.png'`. Replacing the file is sufficient.

---

## 2. Delete Organization — `src/pages/OrgDetail.tsx`

**Visibility:** Only `userRole?.role === 'SuperAdmin'`

**UI:** A red "Delete" button next to the Edit button in the header action row.

**Behavior:**
- Clicking opens a `AlertDialog` confirmation ("This will permanently delete the organization and all associated data. This cannot be undone.")
- On confirm: calls `supabase.from('organizations').delete().eq('id', id)`
- On success: shows a toast, navigates to `/organizations`
- On error: shows error toast

**Imports to add:** `AlertDialog`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogCancel`, `AlertDialogAction` from `@/components/ui/alert-dialog`, and `Trash2` from `lucide-react`

**New state:** `const [deleteOpen, setDeleteOpen] = useState(false);`

**DB call:**
```ts
const { error } = await supabase.from('organizations').delete().eq('id', id);
```
RLS already grants SuperAdmin `ALL` access on `organizations`, so no migration needed.

---

## 3. Add Organization — `src/pages/Organizations.tsx`

**Visibility:** SuperAdmin only (requires reading `userRole` from `useAuth()`)

**UI:** A "Add Organization" button with a `+` icon in the top-right of the page header.

**Modal form fields:**
| Field | Input type | Required |
|---|---|---|
| Name | text | Yes |
| Domain | text | Yes |
| Sector | select (government/bank/telecom/health/education/other) | Yes |
| Region | text | Yes |
| Contact Email | email | No |

**Behavior:**
- On submit: calls `supabase.from('organizations').insert(...)` with default `risk_score: 50`, `status: 'Warning'`
- On success: shows toast, invalidates `organizations` query to refresh the list
- On error: shows error toast

**Imports to add:** `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogFooter` from `@/components/ui/dialog`; `Button` from `@/components/ui/button`; `Input` from `@/components/ui/input`; `Label` from `@/components/ui/label`; `Plus` from `lucide-react`; `useQueryClient` from `@tanstack/react-query`; `useAuth` from `@/contexts/AuthContext`; `toast` from `sonner`

**New state:**
```ts
const [addOpen, setAddOpen] = useState(false);
const [addForm, setAddForm] = useState({ name: '', domain: '', sector: 'government', region: 'Banaadir', contact_email: '' });
const [addSaving, setAddSaving] = useState(false);
```

---

## Files Changed

| File | Change |
|---|---|
| `src/assets/logo.png` | Replace with new uploaded logo |
| `src/pages/OrgDetail.tsx` | Add delete state + AlertDialog + Trash2 button |
| `src/pages/Organizations.tsx` | Add add-org state + Dialog + Plus button + form |

No database migrations required — all operations are covered by existing RLS policies.
