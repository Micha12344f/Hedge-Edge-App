from dotenv import load_dotenv
import os, httpx, json
load_dotenv(r"C:/Users/sossi/Desktop/Business/Orchestrator Hedge Edge/Orchestrator/.env")
key = os.environ.get("CREEM_TEST_API_KEY")
url = os.environ.get("CREEM_TEST_API_URL", "https://test-api.creem.io")
headers = {"x-api-key": key, "Content-Type": "application/json"}

r = httpx.get(f"{url}/v1/subscriptions/search", headers=headers, timeout=10)
print("Subscriptions:", r.status_code)
if r.status_code == 200:
    data = r.json()
    for sub in data.get("items", [])[:5]:
        sid = sub.get("id")
        status = sub.get("status")
        lk = sub.get("license_key")
        lk_key = lk.get("key") if isinstance(lk, dict) else lk
        print(f"  sub={sid}, status={status}, license_key={lk_key}")
else:
    print(r.text[:400])

# Also try licenses search
r2 = httpx.get(f"{url}/v1/licenses/search", headers=headers, timeout=10)
print("\nLicenses:", r2.status_code)
if r2.status_code == 200:
    data = r2.json()
    for lic in data.get("items", [])[:10]:
        print(f"  key={lic.get('key')}, status={lic.get('status')}, disabled={lic.get('disabled')}")
else:
    print(r2.text[:400])
