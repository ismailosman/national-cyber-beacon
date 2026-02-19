

# Replace Favicon with Somalia Cyber Defence Logo

## What's Changing

The browser tab currently shows a default favicon. This will be replaced with the uploaded Somalia Cyber Defence emblem so the logo appears in browser tabs, bookmarks, and other browser UI.

## Steps

1. **Copy the uploaded logo** to `public/favicon.png`
2. **Update `index.html`** to reference the new favicon with the correct type

## Technical Details

**File: `index.html`** -- Add a favicon link tag in the `<head>`:
```html
<link rel="icon" href="/favicon.png" type="image/png">
```

**Asset:** Copy `user-uploads://WhatsApp_Image_2026-02-19_at_10.12.39_AM.jpeg` to `public/favicon.png`

One file edit, one asset copy. The old `public/favicon.ico` will be replaced.

