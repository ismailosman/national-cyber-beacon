

## Add "Clear All" Button to Scan History

Add a bulk delete button to the scan history panel that removes all completed (done) or failed (error) scans at once, with a confirmation dialog to prevent accidental deletion.

### Changes

**1. `src/components/scanner/ScanHistory.tsx`**
- Add a "Clear All" button in the header next to the title
- Button only appears when there are completed/failed scans to clear
- Clicking opens an AlertDialog confirmation before deleting
- On confirm, calls `onClearAll` callback

**2. `src/components/scanner/SecurityDashboard.tsx`**
- Add `handleClearAll` function that iterates over history items with status "done" or "error" and calls `deleteScan` for each
- Pass `handleClearAll` as a prop to `ScanHistory`
- After clearing, refresh history and reset active scan if it was deleted

### Technical Details

- The confirmation dialog uses the existing `AlertDialog` component from the UI library
- The "Clear All" button will be styled as a small ghost/destructive button
- Filtering logic: `history.filter(s => s.status === "done" || s.status === "error")` determines which scans to delete
- Each scan is deleted via the existing `deleteScan` API call
- The button is disabled while deletions are in progress

