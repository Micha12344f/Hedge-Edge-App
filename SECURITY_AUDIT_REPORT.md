# Hedge Edge Security Audit Report

**Date:** February 1, 2026  
**Auditor:** GitHub Copilot (Claude Opus 4.5)  
**Scope:** Full codebase security review  
**Status:** ⚠️ Moderate Risk - Several issues identified

---

## Executive Summary

Hedge Edge is a desktop trading application connecting to MetaTrader 5 and cTrader platforms via native agents. The architecture involves:
- Electron desktop app with React frontend
- Python backend APIs (local + VPS deployment)
- Native DLLs (C++) for MT5 license validation
- MQL5/C# trading agents
- Supabase for optional cloud sync
- ZeroMQ for high-performance IPC

**Overall Risk Assessment:** MODERATE  
Several security weaknesses identified, primarily around:
1. Credential handling in API endpoints
2. Exposed Supabase keys committed to repository
3. Overly permissive CORS configurations
4. Insufficient input validation in some endpoints
5. Build artifacts committed to repository

---

## 🔴 CRITICAL VULNERABILITIES

### 1. Supabase Publishable Key Committed to Repository
**File:** [Hedge-Edge-Front-end/.env](Hedge-Edge-Front-end/.env)  
**Risk:** HIGH  

```
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Issue:** While this is technically a "publishable" (anon) key, it's still committed to version control. Anyone with repository access can see your Supabase project ID and potentially enumerate endpoints.

**Mitigation:**
- Remove from version control, use `.env.local` instead
- Ensure Row Level Security (RLS) is properly configured in Supabase
- Rotate this key periodically

### 2. MT5 Credentials Transmitted in Request Body
**Files:** [backend/mt5_vps_server.py](backend/mt5_vps_server.py#L232-L298)

```python
@app.route('/api/validate', methods=['POST'])
def validate_credentials():
    login = data.get('login')
    password = data.get('password')  # Password in request body!
    server = data.get('server')
```

**Issue:** MT5 account credentials (including passwords) are transmitted in HTTP request bodies. While protected by API key auth, if HTTPS is misconfigured or compromised, credentials are exposed.

**Mitigation:**
- Never log passwords (currently not logged - good)
- Ensure HTTPS is enforced in production
- Consider credential hashing or encrypted payload for transit
- Add rate limiting per-account to prevent brute force

### 3. Overly Permissive CORS Configuration
**Files:** [backend/license_api_production.py#L277-L285](backend/license_api_production.py#L277-L285)

```python
allow_origins=[
    "http://localhost:*",
    "http://127.0.0.1:*",
    "https://*.hedge-edge.com",
    "app://.",  # Electron app
],
```

**Issue:** Wildcard localhost origins (`localhost:*`) could allow any local application to make authenticated requests to the license API.

**Mitigation:**
- Specify exact ports in development
- Remove localhost/127.0.0.1 from production builds
- Use environment-based CORS configuration

---

## 🟠 HIGH SEVERITY ISSUES

### 4. API Key Static Comparison (Timing Attack Vulnerable)
**File:** [backend/mt5_vps_server.py#L54-L59](backend/mt5_vps_server.py#L54-L59)

```python
def require_api_key(f):
    api_key = request.headers.get('X-API-Key')
    if not api_key or api_key != API_KEY:  # Direct string comparison
        return jsonify({'error': 'Invalid API key'}), 401
```

**Issue:** Direct string comparison is vulnerable to timing attacks. An attacker could measure response times to deduce API key characters.

**Mitigation:**
```python
import secrets
if not secrets.compare_digest(api_key or '', API_KEY):
    return jsonify({'error': 'Invalid API key'}), 401
```

### 5. License Token Generation Lacks Sufficient Entropy
**File:** [backend/license_api_server.py#L62-L65](backend/license_api_server.py#L62-L65)

```python
def generate_token(license_key: str, device_id: str) -> str:
    payload = f"{license_key}:{device_id}:{datetime.now().isoformat()}"
    return hashlib.sha256(payload.encode()).hexdigest()[:64]
```

**Issue:** Token generation is deterministic based on known inputs. An attacker knowing the license key and device ID could predict tokens.

**Production version** ([license_api_production.py#L197](backend/license_api_production.py#L197)) is better but still uses `secrets.token_bytes(32)` mixed with predictable payload.

**Mitigation:**
- Use `secrets.token_urlsafe(64)` directly
- Store tokens in database, don't derive from inputs

### 6. Session Token Stored in Local File
**File:** [Hedge-Edge-Front-end/electron/license-store.ts#L75-L90](Hedge-Edge-Front-end/electron/license-store.ts#L75-L90)

```typescript
const encryptedData = await fs.readFile(this.licenseFilePath);
// License key encrypted with safeStorage (DPAPI)
```

**Issue:** While using Electron's `safeStorage` (DPAPI on Windows), the encrypted file is still accessible if an attacker gains user-level access to the machine.

**Mitigation:**
- This is acceptable for desktop apps, but document the trust model
- Consider additional file-level permissions restrictions
- Warn users about shared/compromised machines

### 7. ZeroMQ Binds to Localhost Without Authentication
**Files:** [Hedge-Edge-Front-end/electron/zmq-bridge.ts#L118-L123](Hedge-Edge-Front-end/electron/zmq-bridge.ts#L118-L123)

```typescript
dataPort: 51810,
commandPort: 51811,
// No authentication, no encryption
```

**Issue:** ZMQ sockets bind to localhost without authentication. Any local process can connect and receive trading data or send commands.

**Mitigation:**
- Implement ZMQ CURVE authentication (libsodium is already available)
- Add message signing for command verification
- Document that local security boundary is assumed

---

## 🟡 MEDIUM SEVERITY ISSUES

### 8. Hardcoded Test License Keys
**File:** [backend/license_api_server.py#L32-L53](backend/license_api_server.py#L32-L53)

```python
TEST_LICENSES = {
    "TEST-1234-5678-DEMO": {...},
    "PROD-ABCD-EFGH-FULL": {...},
    "ENTE-RPRS-TEAM-PLAN": {...},
}
```

**Issue:** Test license keys are hardcoded. If this development server is accidentally exposed, anyone could use these keys.

**Mitigation:**
- Remove or randomize test keys in production builds
- Ensure this server is never deployed publicly
- Add clear "DEVELOPMENT ONLY" warnings

### 9. Device ID Based on Predictable Factors
**File:** [Hedge-Edge-Front-end/electron/license-store.ts#L186-L199](Hedge-Edge-Front-end/electron/license-store.ts#L186-L199)

```typescript
private getDeviceId(): string {
    const factors = [
      os.hostname(),
      os.platform(),
      os.arch(),
      os.cpus()[0]?.model || 'unknown',
    ].join('|');
    return crypto.createHash('sha256').update(factors).digest('hex').substring(0, 32);
}
```

**Issue:** Device ID can be spoofed by an attacker who knows or guesses these factors.

**Mitigation:**
- Add more hardware-specific identifiers
- Include a random component stored on first run
- Consider MAC address (with privacy implications)

### 10. Debug Endpoint Exposes Server Statistics
**File:** [backend/license_api_server.py#L188-L200](backend/license_api_server.py#L188-L200)

```python
@app.route('/v1/license/status', methods=['GET'])
def license_status():
    return jsonify({
        "test_keys_available": list(TEST_LICENSES.keys())  # Exposes test keys!
    })
```

**Issue:** The status endpoint exposes available test keys publicly.

**Mitigation:**
- Remove `test_keys_available` from response
- Add authentication to status endpoint
- Limit information disclosure

### 11. dangerouslySetInnerHTML Usage
**File:** [Hedge-Edge-Front-end/src/components/ui/chart.tsx#L70](Hedge-Edge-Front-end/src/components/ui/chart.tsx#L70)

```tsx
dangerouslySetInnerHTML={{
    __html: Object.entries(THEMES).map(...)  // CSS generation
}}
```

**Issue:** While the content is generated from config objects (not user input), this pattern is risky if config is ever user-modifiable.

**Mitigation:**
- Ensure chart config never contains user-supplied strings
- Consider CSS-in-JS alternatives
- Add runtime validation of config values

### 12. Error Messages May Leak Internal State
**File:** [backend/mt5_api_server.py#L160](backend/mt5_api_server.py#L160)

```python
return jsonify({'error': str(e)}), 500
```

**Issue:** Raw exception messages may leak internal implementation details to clients.

**Mitigation:**
```python
import logging
logger.exception("Internal error in get_mt5_snapshot")
return jsonify({'error': 'Internal server error'}), 500
```

---

## 🟢 LOW SEVERITY / INFORMATIONAL

### 13. Build Artifacts Committed
**Directory:** [Hedge-Edge-Front-end/dist-electron/](Hedge-Edge-Front-end/dist-electron/)

**Issue:** Compiled JavaScript files are in the repository. This is unusual and can lead to:
- Outdated builds being used
- Confusion about source of truth
- Larger repository size

**Mitigation:**
- Add `dist-electron/` to `.gitignore`
- Build as part of CI/CD pipeline

### 14. Session Logs Contain Implementation Details
**Directory:** [session-logs/](session-logs/)

**Issue:** Development session logs document internal architecture, which could aid attackers in understanding the system.

**Mitigation:**
- Consider excluding from public repositories
- Remove sensitive implementation details

### 15. No HTTPS Enforcement in Development Servers
**Files:** Multiple backend files

**Issue:** Flask servers default to HTTP. In development this is fine, but no warnings about HTTPS requirements.

**Mitigation:**
- Add startup warnings about HTTPS requirements
- Document reverse proxy (nginx) setup for production

### 16. Insufficient Input Length Validation
**File:** [backend/license_api_production.py#L114-L119](backend/license_api_production.py#L114-L119)

```python
licenseKey: str = Field(..., min_length=8, max_length=64)
deviceId: str = Field(..., min_length=8, max_length=255)
```

**Issue:** While lengths are validated, very long deviceIds (255 chars) could be used in DoS attacks via logging/storage.

**Mitigation:**
- Reduce max_length for deviceId to reasonable value (64-96 chars)
- Truncate in logs regardless

---

## 📁 UNNECESSARY FILES TO REMOVE

The following files/directories appear unnecessary and should be considered for removal:

### Definitely Remove
| Path | Reason |
|------|--------|
| `bin/mt5-cluster-deprecated/` | Explicitly marked as deprecated; contains outdated code |
| `Hedge-Edge-Front-end/dist-electron/` | Build artifacts; should be generated, not committed |
| `session-logs/*.json` | Development logs; not needed in repository |
| `session-logs/Hedge-Edge-app.code-workspace` | Duplicate workspace file |

### Consider Removing
| Path | Reason |
|------|--------|
| `bin/QUALITY_ASSESSMENT_REPORT.md` | Internal report; may not belong in `bin/` |
| `bin/UI_IMPROVEMENTS_SUMMARY.md` | Internal report; may not belong in `bin/` |
| `bin/UI_INSPECTION_REPORT.md` | Internal report; may not belong in `bin/` |
| `backend/license_api_server.py` | Mock/test server; ensure not deployed to production |

### Ensure Not Committed
| Path | Reason |
|------|--------|
| `Hedge-Edge-Front-end/.env` | Contains actual Supabase keys; should be in `.env.local` |
| `backend/.env.mt5` | Credential template; ensure it stays empty |

---

## 🎯 BIGGEST RISKS BY BUSINESS IMPACT

### 1. **License Bypass Risk** (CRITICAL)
The license validation system is the core business protection. Risks:
- Predictable token generation could allow token forging
- Device ID spoofing could circumvent device limits
- Local ZMQ channels could be intercepted to capture license tokens

**Business Impact:** Revenue loss from license circumvention

### 2. **Trading Credential Theft** (HIGH)
MT5/cTrader credentials are transmitted through multiple layers:
- Desktop app → Python agent (local)
- Desktop app → VPS server (remote)
- Stored in memory during sessions

**Business Impact:** User account compromise, legal liability

### 3. **API Key Compromise** (HIGH)
The VPS API key is a single point of failure:
- If compromised, attacker can access all users' trading data
- Static API key (no rotation mechanism shown)
- Transmitted in headers (potentially logged by proxies)

**Business Impact:** Mass data breach

### 4. **Supply Chain Risk** (MEDIUM)
Native DLLs (libzmq, libsodium) are included pre-built:
- Source provenance unclear
- Could contain malicious code

**Business Impact:** Malware distribution to users

### 5. **Electron Security Model** (MEDIUM)
Desktop app has significant attack surface:
- Bundled Node.js with full filesystem access
- Trading credentials in memory
- Could be targeted by malware

**Business Impact:** Individual user compromise

---

## ✅ POSITIVE SECURITY FINDINGS

1. **Good XSS Protection** - Comprehensive sanitization utilities in [security.ts](Hedge-Edge-Front-end/src/lib/security.ts)

2. **Secure Credential Storage** - Uses Electron's `safeStorage` (DPAPI) for sensitive data

3. **Input Validation** - Pydantic models with field validators in production API

4. **Rate Limiting** - Implemented in production license API

5. **TLS 1.2+ Enforced** - Native DLL enforces modern TLS versions

6. **Preload Script Isolation** - Proper context bridge usage in Electron

7. **CORS Headers** - Properly configured (though overly permissive in dev)

8. **API Key Requirement** - VPS server enforces API key presence

---

## 📋 RECOMMENDED ACTIONS

### Immediate (Before Production)
1. ❗ Remove `.env` from git, rotate Supabase keys
2. ❗ Fix timing-safe API key comparison
3. ❗ Remove test keys from status endpoint response
4. ❗ Add `dist-electron/` to `.gitignore`

### Short-term (Next Sprint)
1. 🔶 Implement ZMQ CURVE authentication
2. 🔶 Make token generation truly random
3. 🔶 Restrict CORS origins per environment
4. 🔶 Add device ID entropy

### Medium-term
1. 📅 Implement API key rotation mechanism
2. 📅 Add security audit logging
3. 📅 Document threat model
4. 📅 Consider code signing for DLLs

---

## Conclusion

The Hedge Edge codebase demonstrates security awareness with proper input sanitization, Electron security practices, and credential encryption. However, several issues need attention before production deployment, particularly around license token generation, credential handling, and CORS configuration.

The most critical business risk is potential license bypass, followed by trading credential theft. Addressing the immediate actions above would significantly improve the security posture.

---

*Report generated by GitHub Copilot security review*  
*This is not a penetration test - a professional security audit is recommended before production launch*
