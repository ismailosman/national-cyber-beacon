
## Add GitHub Token Secret

### What needs to happen
Add a new secret called `GITHUB_TOKEN` to securely store the user's GitHub API token. This token is likely used by the security scanner's SAST functionality when cloning/accessing GitHub repositories for static analysis.

### Steps
1. Add a new secret `GITHUB_TOKEN` via the secrets tool
2. Verify any edge functions that need the token (e.g., `security-scanner-proxy`) can access it via `Deno.env.get("GITHUB_TOKEN")`

### Technical details
- The secret will be stored securely and accessible to all backend functions
- No code changes are needed unless the token needs to be passed to the upstream API -- the scanner proxy already forwards requests to `cybersomalia.com` which may handle GitHub access on its own
