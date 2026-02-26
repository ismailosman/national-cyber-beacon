

## Fix Map "Requires WebGL" Error and Broken Retry

### Problem
1. The "Map requires WebGL" error appears because the preview environment sometimes lacks WebGL support
2. The **Retry button doesn't work** -- it clears `mapError` and removes `mapRef`, but the map initialization `useEffect` only depends on `[mapToken]`, which hasn't changed, so the effect never re-runs

### Solution
Add a `retryCount` state variable that increments on Retry click and is included in the map init `useEffect` dependency array, forcing re-initialization.

### Changes in `src/components/cyber-map/ThreatMapEngine.tsx`

1. Add a `retryCount` state: `const [retryCount, setRetryCount] = useState(0)`
2. Update the Retry button handler to increment `retryCount` instead of manually clearing state
3. Add `retryCount` to the map init `useEffect` dependency array (`[mapToken, retryCount]`)
4. The Retry handler becomes: clear error, remove old map, increment retryCount -- which triggers the effect to re-run

### File Modified
- `src/components/cyber-map/ThreatMapEngine.tsx`

