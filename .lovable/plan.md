

## Fix: Scan Queue Flickering

### Problem
The queued scan item flickers between showing and disappearing because of a circular React dependency:
- `fetchJobs` lists `recentScans` as a `useCallback` dependency
- Inside `fetchJobs`, it updates `recentScans` via `setRecentScans`
- This causes `fetchJobs` to be recreated, restarting the polling interval
- The rapid re-polling clears the local scan entry, creating a flicker loop

### Solution
Use a **ref** (`useRef`) to track recent scans instead of reactive state, breaking the circular dependency. The ref lets `fetchJobs` read and write recent scans without triggering re-renders or recreating itself.

### Changes

**File: `src/pages/ScanQueuePanel.tsx`**

1. Replace `recentScans` state with a ref:
   - Change `const [recentScans, setRecentScans] = useState<Job[]>([])` to `const recentScansRef = useRef<Job[]>([])`

2. Update `fetchJobs` to use the ref:
   - Read from `recentScansRef.current` instead of `recentScans`
   - Write to `recentScansRef.current = validRecent` instead of `setRecentScans`
   - Remove `recentScans` from the `useCallback` dependency array (back to `[]`)

3. Update `startScan` to use the ref:
   - Change `setRecentScans(prev => [localJob, ...prev])` to `recentScansRef.current = [localJob, ...recentScansRef.current]`

This is a surgical fix -- only changing how `recentScans` is stored (ref vs state). The merge logic, dedup, and 60-second expiry all stay the same.

### Result
- Scans will appear immediately and stay visible for 60 seconds (or until they appear in the API response)
- No more flickering
- Polling interval remains stable at 3 seconds
- Debug footer continues to work

