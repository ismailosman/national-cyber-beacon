
## Update SECURITY_API_KEY

Update the existing `SECURITY_API_KEY` secret with the new value provided by the user. This key is used by the `security-scanner-proxy` edge function to authenticate requests to the backend API at cybersomalia.com.

### Steps
1. Update the `SECURITY_API_KEY` secret with the new value
2. The change takes effect immediately for all edge functions

### Impact
- No code changes needed
- The `security-scanner-proxy` edge function will automatically use the new key for all API requests
