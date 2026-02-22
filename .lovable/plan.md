

## Change OrgCard Click-Through to Uptime Monitor

### What Changes

When clicking an organization card in the "Organization Security Overview" section on the dashboard, users will be navigated to the **Uptime Monitor** page (`/uptime`) instead of the organization detail page (`/organizations/:id`).

### Changes

**File: `src/components/dashboard/OrgCard.tsx` (line 68)**

Update the `onClick` navigation from:
```typescript
onClick={() => navigate(`/organizations/${id}`)}
```
To:
```typescript
onClick={() => navigate('/uptime')}
```

This is a single-line change that redirects all org card clicks to the Uptime Monitor page, where users can see live ping status, response times, SSL details, and uptime history for all monitored organizations.

