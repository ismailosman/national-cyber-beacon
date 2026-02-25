## Fix: Scroll to Top on Page Navigation

### Problem

When navigating between pages (e.g., clicking Security dropdown links), React Router preserves the scroll position from the previous page, causing new pages to appear scrolled to the bottom.

### Solution

Create a small `ScrollToTop` component that listens for route changes and scrolls the window to the top. Place it inside the `BrowserRouter` in `App.tsx`.

### Changes

**New file: `src/components/ScrollToTop.tsx**`

- A simple component that uses `useEffect` + `useLocation` from react-router-dom
- Calls `window.scrollTo(0, 0)` on every pathname change
- Renders nothing (returns `null`)

**Modified file: `src/App.tsx**`

- Import and add `<ScrollToTop />` as the first child inside `<BrowserRouter>`, before `<Routes>`

This is a standard React Router pattern and requires no new dependencies. This happens only when using mobile devices.  Desktop is good. 