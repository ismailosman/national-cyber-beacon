

## Add Scan Queue Panel Page

### Overview
Create a new protected page at `/scan-queue` that displays a real-time scan queue panel connected to your Kali VPS via WebSocket (socket.io).

### Changes

**1. Install dependency**
- Add `socket.io-client` to the project

**2. Create `src/pages/ScanQueuePanel.tsx`**
- Adapt the provided code to TypeScript (.tsx) with proper type definitions for Job, status types, etc.
- Replace the hardcoded `API_BASE` with a constant you can easily update (or read from environment)
- Use the project's existing UI patterns (e.g., existing `Input`, `Button` components from shadcn/ui) where appropriate, while keeping the custom styling from the provided code
- Add TypeScript interfaces for `Job` type with fields: `id`, `status`, `scan_type`, `target`, `progress`, `log`, `started_at`, `created_at`

**3. Register route in `src/App.tsx`**
- Add `/scan-queue` as a protected route inside the `ProtectedRoutes` component (within the `AppLayout`)

**4. Add sidebar nav entry in `src/components/layout/Sidebar.tsx`**
- Add a "Scan Queue" item pointing to `/scan-queue` with an appropriate icon (e.g., `ListOrdered` from lucide-react)

### API Base URL
Since you mentioned you have the VPS address ready, the code will use a constant `API_BASE` at the top of the file that you can update. Please share the URL after implementation so we can set it.

### Technical Notes
- The `socket.io-client` library will be installed as a new dependency
- The page connects via WebSocket and listens for `jobs_snapshot` and `job_update` events
- New scans are submitted via POST to `{API_BASE}/api/scan/start`
- The page is only accessible to authenticated users (behind the existing auth guard)

