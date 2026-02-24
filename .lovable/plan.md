

## Update Sidebar Navigation

Simple navigation cleanup with three changes:

### Changes

**`src/components/layout/Sidebar.tsx`**
- Remove the CERT-SO nav item (`{ to: '/cert', icon: Radio, label: 'CERT-SO' }`)
- Dashboard (`/`) and Security Scanner (`/security-scanner`) are already present -- no changes needed for those
- Remove the unused `Radio` import from lucide-react

**`src/App.tsx`**
- Remove the `/cert` route from ProtectedRoutes since CERT-SO is being removed
- Remove the `CertAdvisories` import

### What stays unchanged
- Dashboard route at `/` with `LayoutDashboard` icon -- already first in the sidebar
- Security Scanner route at `/security-scanner` with `Search` icon -- already in the sidebar
- All other navigation items remain as-is

