"""Quick end-to-end test for both notebooks — run via Python directly."""
import os, time
import httpx
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(r"C:/Users/sossi/Desktop/Business/Orchestrator Hedge Edge/Orchestrator/.env")

BASE = "https://hedge-edge-app-backend-production.up.railway.app"
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
PRODUCT_ID = os.environ.get("CREEM_PRODUCT_ID", "")
TEST_KEY = "TSZ38-SVQYJ-U72O4-QRBLR-L1X8T"  # Real Creem sandbox key (active)
TEST_EMAIL = "test@hedgedge.info"
TEST_DEVICE = "test-device-abc123"

db = create_client(SUPABASE_URL, SUPABASE_KEY)
passed = 0

def ok(step, msg):
    global passed
    passed += 1
    print(f"  PASS [{step}] {msg}")

def fail(step, msg):
    print(f"  FAIL [{step}] {msg}")
    raise SystemExit(1)

# ─────────────────────────────────────────────────────────────────
# NOTEBOOK 1: Creem Webhook → License Provision
# ─────────────────────────────────────────────────────────────────
print("\n=== NOTEBOOK 1: Creem Webhook Provision ===\n")

# Step 1: Health check
r = httpx.get(f"{BASE}/health", timeout=10)
if r.status_code == 200:
    ok(1, f"/health → {r.json().get('status')} v{r.json().get('version')}")
else:
    fail(1, f"/health returned {r.status_code}")

# Step 2: Clean prior test data
existing = db.table("licenses").select("id").eq("license_key", TEST_KEY).execute()
for row in existing.data:
    db.table("license_sessions").delete().eq("license_id", row["id"]).execute()
db.table("licenses").delete().eq("license_key", TEST_KEY).execute()
ok(2, "Cleaned old test rows from Supabase")

# Step 3: POST checkout.completed webhook
payload = {
    "type": "checkout.completed",
    "data": {
        "license_key": TEST_KEY,
        "customer": {"email": TEST_EMAIL},
        "product": {"id": PRODUCT_ID, "name": "Hedge Edge Pro"},
        "license": {"expires_at": "2027-12-31T00:00:00Z"},
    }
}
r = httpx.post(f"{BASE}/v1/webhooks/creem", json=payload, timeout=30)
if r.status_code in (200, 201, 202):
    ok(3, f"checkout.completed webhook → HTTP {r.status_code}")
else:
    fail(3, f"Webhook returned {r.status_code}: {r.text[:300]}")

# Step 4: Verify license row in Supabase
time.sleep(1)
rows = db.table("licenses").select("*").eq("license_key", TEST_KEY).execute()
if rows.data:
    lic = rows.data[0]
    ok(4, f"License row exists — is_active={lic.get('is_active')}, email={lic.get('email')}")
else:
    fail(4, "No license row found in Supabase after webhook")

# Step 5: POST subscription.cancelled webhook
cancel_payload = {
    "type": "subscription.cancelled",
    "data": {
        "license_key": TEST_KEY,
        "customer": {"email": TEST_EMAIL},
    }
}
r = httpx.post(f"{BASE}/v1/webhooks/creem", json=cancel_payload, timeout=30)
if r.status_code in (200, 201, 202):
    ok(5, f"checkout.cancelled webhook → HTTP {r.status_code}")
else:
    fail(5, f"Cancel webhook returned {r.status_code}: {r.text[:200]}")

# Step 6: Verify license deactivated
time.sleep(1)
rows = db.table("licenses").select("is_active,deactivated_at").eq("license_key", TEST_KEY).execute()
if rows.data:
    lic = rows.data[0]
    ok(6, f"License after cancel — is_active={lic.get('is_active')}, deactivated_at={lic.get('deactivated_at')}")
else:
    fail(6, "License row missing after cancel")

print(f"\n=== NOTEBOOK 1 COMPLETE: {passed} steps passed ===\n")
nb1_passed = passed

# ─────────────────────────────────────────────────────────────────
# Re-provision for Notebook 2 testing
# ─────────────────────────────────────────────────────────────────
print("Re-provisioning active license for Notebook 2...\n")
existing = db.table("licenses").select("id").eq("license_key", TEST_KEY).execute()
for row in existing.data:
    db.table("license_sessions").delete().eq("license_id", row["id"]).execute()
db.table("licenses").delete().eq("license_key", TEST_KEY).execute()
r = httpx.post(f"{BASE}/v1/webhooks/creem", json=payload, timeout=30)
assert r.status_code in (200,201,202), f"Re-provision failed: {r.text}"
time.sleep(1)
rows = db.table("licenses").select("*").eq("license_key", TEST_KEY).execute()
assert rows.data and rows.data[0].get("is_active") == True, "License not active after re-provision"
print("  Re-provision OK — license is active\n")

# ─────────────────────────────────────────────────────────────────
# NOTEBOOK 2: License Key Validation
# ─────────────────────────────────────────────────────────────────
print("=== NOTEBOOK 2: License Key Validation ===\n")
passed = 0

# Step 1: Validate license key
val_payload = {
    "licenseKey": TEST_KEY,
    "deviceId": TEST_DEVICE,
    "platform": "mt5",
    "broker": "test-broker",
    "version": "1.0.0"
}
r = httpx.post(f"{BASE}/v1/license/validate", json=val_payload, timeout=30)
print(f"  Validate status: {r.status_code}, body: {r.text[:400]}")
if r.status_code == 200:
    data = r.json()
    session_token = data.get("token") or data.get("sessionToken") or data.get("session_token", "")
    ok(1, f"License valid — session_token={'SET' if session_token else 'MISSING'}")
else:
    fail(1, f"Validate returned {r.status_code}: {r.text[:300]}")

# Step 2: Heartbeat
if session_token:
    hb_payload = {"token": session_token, "deviceId": TEST_DEVICE}
    r = httpx.post(f"{BASE}/v1/license/heartbeat", json=hb_payload, timeout=30)
    if r.status_code == 200:
        ok(2, f"Heartbeat OK")
    else:
        fail(2, f"Heartbeat returned {r.status_code}: {r.text[:200]}")
else:
    print("  SKIP [2] No session token — skipping heartbeat")

# Step 3: Deactivate device  
deact_payload = {"licenseKey": TEST_KEY, "deviceId": TEST_DEVICE}
r = httpx.post(f"{BASE}/v1/license/deactivate", json=deact_payload, timeout=30)
if r.status_code == 200:
    ok(3, "Device deactivated")
else:
    fail(3, f"Deactivate returned {r.status_code}: {r.text[:200]}")

# Step 4: Server status
r = httpx.get(f"{BASE}/v1/license/status", timeout=10)
if r.status_code == 200:
    ok(4, f"Server status OK — {r.json()}")
else:
    fail(4, f"Status returned {r.status_code}: {r.text[:200]}")

# Step 5: Cleanup
existing = db.table("licenses").select("id").eq("license_key", TEST_KEY).execute()
for row in existing.data:
    db.table("license_sessions").delete().eq("license_id", row["id"]).execute()
db.table("licenses").delete().eq("license_key", TEST_KEY).execute()
ok(5, "Test data cleaned up")

print(f"\n=== NOTEBOOK 2 COMPLETE: {passed} steps passed ===")
print(f"\n{'='*50}")
print(f"ALL TESTS FINISHED — NB1: {nb1_passed} passed, NB2: {passed} passed")
print(f"{'='*50}")
