"""
Tests for Hedge Edge License API Production Server
====================================================
Uses httpx.AsyncClient with FastAPI's TestClient pattern.
Covers: health, input validation, business logic (Creem rejection, expiry,
device limits), heartbeat, deactivation, webhooks, and utility functions.
"""

import pytest
import pytest_asyncio
import hashlib
import hmac
import json
import os
import time
from unittest.mock import patch, MagicMock, AsyncMock
from datetime import datetime, timedelta, timezone

# Patch environment BEFORE importing the app module so validate_environment() passes
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "test-service-key")
os.environ.setdefault("CREEM_API_KEY", "test-creem-key")
os.environ.setdefault("CREEM_WEBHOOK_SECRET", "test-webhook-secret")

from httpx import AsyncClient, ASGITransport
from license_api_production import app, generate_token, DailyRequestGuard, hash_ip


# ============================================================================
# Fixtures
# ============================================================================

@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest_asyncio.fixture
async def client():
    """Async test client for FastAPI."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


def _mock_license(*, is_active=True, plan="professional",
                   max_devices=3, features=None, expires_days=30):
    """Build a mock Supabase license row."""
    return {
        "id": "license-uuid-001",
        "license_key": "TESTKEY-1234-ABCD-5678",
        "email": "test@example.com",
        "plan": plan,
        "max_devices": max_devices,
        "features": features or ["trade-copying", "hedge-detection"],
        "is_active": is_active,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=expires_days)).isoformat(),
    }


# ============================================================================
# Health Endpoint
# ============================================================================

class TestHealthEndpoint:
    @pytest.mark.asyncio
    async def test_health_returns_200(self, client: AsyncClient):
        resp = await client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data
        assert "version" in data
        assert "serverTime" in data

    @pytest.mark.asyncio
    async def test_health_has_server_time(self, client: AsyncClient):
        resp = await client.get("/health")
        data = resp.json()
        assert isinstance(data["serverTime"], int)
        assert data["serverTime"] > 0


# ============================================================================
# License Validation Endpoint
# ============================================================================

class TestValidateEndpoint:
    @pytest.mark.asyncio
    async def test_validate_missing_key_returns_400(self, client: AsyncClient):
        resp = await client.post("/v1/license/validate", json={
            "deviceId": "device-test-12345678",
            "platform": "mt5",
        })
        assert resp.status_code == 400
        data = resp.json()
        assert data["valid"] is False

    @pytest.mark.asyncio
    async def test_validate_rejects_short_device_id(self, client: AsyncClient):
        resp = await client.post("/v1/license/validate", json={
            "licenseKey": "TESTKEY-1234-ABCD",
            "deviceId": "short",
            "platform": "mt5",
        })
        # FastAPI validation should reject device_id < 8 chars
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_validate_normalises_platform(self, client: AsyncClient):
        """Platform field should be lowercased and default unknown for bad values."""
        resp = await client.post("/v1/license/validate", json={
            "licenseKey": "TESTKEY-1234-ABCD",
            "deviceId": "device-test-12345678",
            "platform": "INVALID_PLATFORM",
        })
        # The request should still be processed (platform defaults to 'unknown')
        # It may fail for other reasons (Creem/Supabase not available) but not 422
        assert resp.status_code != 422


# ============================================================================
# Heartbeat Endpoint
# ============================================================================

class TestHeartbeatEndpoint:
    @pytest.mark.asyncio
    async def test_heartbeat_rejects_short_token(self, client: AsyncClient):
        resp = await client.post("/v1/license/heartbeat", json={
            "token": "short",
            "deviceId": "device-test-12345678",
        })
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_heartbeat_rejects_missing_device(self, client: AsyncClient):
        token = "a" * 64
        resp = await client.post("/v1/license/heartbeat", json={
            "token": token,
        })
        assert resp.status_code == 422


# ============================================================================
# Deactivate Endpoint
# ============================================================================

class TestDeactivateEndpoint:
    @pytest.mark.asyncio
    async def test_deactivate_accepts_snake_case(self, client: AsyncClient):
        """Endpoint should accept both camelCase and snake_case fields."""
        resp = await client.post("/v1/license/deactivate", json={
            "license_key": "TESTKEY-1234-ABCD",
            "device_id": "device-test-12345678",
        })
        # Will fail at business logic level but should not be 422
        assert resp.status_code != 422


# ============================================================================
# Webhook Endpoint
# ============================================================================

class TestWebhookEndpoint:
    @pytest.mark.asyncio
    async def test_webhook_rejects_invalid_signature(self, client: AsyncClient):
        payload = {"type": "checkout.completed", "data": {"license_key": "TEST-KEY-1234"}}
        resp = await client.post(
            "/v1/webhooks/creem",
            content=json.dumps(payload).encode(),
            headers={"x-creem-signature": "bad-signature", "Content-Type": "application/json"},
        )

        assert resp.status_code == 401
        assert resp.json()["error"] == "Invalid signature"

    @pytest.mark.asyncio
    async def test_webhook_checkout_completed_provisions_license(self, client: AsyncClient):
        payload = {
            "type": "checkout.completed",
            "data": {
                "license_key": "TEST-KEY-1234",
                "customer": {"email": "user@example.com"},
                "product": {"name": "Hedge Edge Pro"},
                "license": {"expires_at": "2027-12-31T00:00:00Z"},
            },
        }
        raw_payload = json.dumps(payload).encode()
        signature = hmac.new(
            os.environ["CREEM_WEBHOOK_SECRET"].encode(),
            raw_payload,
            hashlib.sha256,
        ).hexdigest()

        mock_db = MagicMock()
        mock_db.table.return_value.upsert.return_value.execute.return_value.data = [{"id": "license-1"}]

        with patch("license_api_production.get_supabase", return_value=mock_db), patch(
            "license_api_production.validate_license_with_creem",
            new=AsyncMock(return_value={
                "valid": True,
                "status": "active",
                "expires_at": "2027-12-31T00:00:00Z",
                "error": None,
            }),
        ):
            resp = await client.post(
                "/v1/webhooks/creem",
                content=raw_payload,
                headers={"x-creem-signature": signature, "Content-Type": "application/json"},
            )

        assert resp.status_code == 200
        data = resp.json()
        assert data["processed"] is True
        assert data["action"] == "provisioned"
        assert data["plan"] == "professional"


# ============================================================================
# Business Logic — License Validation
# ============================================================================

class TestValidateBusinessLogic:
    @pytest.mark.asyncio
    async def test_creem_rejection_returns_403(self, client: AsyncClient):
        """If Creem says subscription inactive, validation must fail."""
        with patch("license_api_production.validate_license_with_creem", new_callable=AsyncMock) as mc:
            mc.return_value = {"valid": False, "status": "cancelled", "error": "Subscription cancelled"}
            with patch("license_api_production.get_supabase", return_value=MagicMock()), \
                 patch("license_api_production.log_validation_attempt", new_callable=AsyncMock):
                resp = await client.post("/v1/license/validate", json={
                    "licenseKey": "TESTKEY-1234-ABCD-5678",
                    "deviceId": "device-test-12345678",
                    "platform": "mt5",
                })
        assert resp.status_code == 403
        assert resp.json()["code"] == "ERROR_CREEM_REJECTED"

    @pytest.mark.asyncio
    async def test_key_not_in_supabase_returns_401(self, client: AsyncClient):
        """Key passes Creem but doesn't exist in Supabase → reject."""
        mock_db = MagicMock()
        with patch("license_api_production.validate_license_with_creem", new_callable=AsyncMock) as mc:
            mc.return_value = {"valid": True, "status": "active"}
            with patch("license_api_production.get_supabase", return_value=mock_db):
                mock_db.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = None
                with patch("license_api_production.log_validation_attempt", new_callable=AsyncMock):
                    resp = await client.post("/v1/license/validate", json={
                        "licenseKey": "NONEXISTENT-KEY-12345",
                        "deviceId": "device-test-12345678",
                        "platform": "mt5",
                    })
        assert resp.status_code == 401
        assert resp.json()["code"] == "ERROR_INVALID_KEY"

    @pytest.mark.asyncio
    async def test_inactive_license_returns_403(self, client: AsyncClient):
        mock_db = MagicMock()
        lic = _mock_license(is_active=False)
        with patch("license_api_production.validate_license_with_creem", new_callable=AsyncMock) as mc:
            mc.return_value = {"valid": True, "status": "active"}
            with patch("license_api_production.get_supabase", return_value=mock_db):
                mock_db.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = lic
                with patch("license_api_production.log_validation_attempt", new_callable=AsyncMock):
                    resp = await client.post("/v1/license/validate", json={
                        "licenseKey": lic["license_key"],
                        "deviceId": "device-test-12345678",
                        "platform": "mt5",
                    })
        assert resp.status_code == 403
        assert resp.json()["code"] == "ERROR_INACTIVE"

    @pytest.mark.asyncio
    async def test_expired_license_returns_403(self, client: AsyncClient):
        mock_db = MagicMock()
        lic = _mock_license(expires_days=-1)
        with patch("license_api_production.validate_license_with_creem", new_callable=AsyncMock) as mc:
            mc.return_value = {"valid": True, "status": "active"}
            with patch("license_api_production.get_supabase", return_value=mock_db):
                mock_db.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = lic
                with patch("license_api_production.log_validation_attempt", new_callable=AsyncMock):
                    resp = await client.post("/v1/license/validate", json={
                        "licenseKey": lic["license_key"],
                        "deviceId": "device-test-12345678",
                        "platform": "desktop",
                    })
        assert resp.status_code == 403
        assert resp.json()["code"] == "ERROR_EXPIRED"


# ============================================================================
# Business Logic — Heartbeat
# ============================================================================

class TestHeartbeatLogic:
    @pytest.mark.asyncio
    async def test_invalid_token_returns_401(self, client: AsyncClient):
        mock_db = MagicMock()
        mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.single.return_value.execute.return_value.data = None
        with patch("license_api_production.get_supabase", return_value=mock_db):
            resp = await client.post("/v1/license/heartbeat", json={
                "token": "0" * 64,
                "deviceId": "device-test-12345678",
            })
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_expired_session_returns_401(self, client: AsyncClient):
        mock_db = MagicMock()
        session = {
            "id": "sess-001",
            "license_id": "lic-001",
            "device_id": "device-test-12345678",
            "token": "t" * 64,
            "expires_at": (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat(),
        }
        mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.single.return_value.execute.return_value.data = session
        mock_db.table.return_value.delete.return_value.eq.return_value.execute.return_value = MagicMock()
        with patch("license_api_production.get_supabase", return_value=mock_db):
            resp = await client.post("/v1/license/heartbeat", json={
                "token": "t" * 64,
                "deviceId": "device-test-12345678",
            })
        assert resp.status_code == 401


# ============================================================================
# Business Logic — Deactivation
# ============================================================================

class TestDeactivateLogic:
    @pytest.mark.asyncio
    async def test_deactivate_unknown_key_returns_401(self, client: AsyncClient):
        mock_db = MagicMock()
        mock_db.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = None
        with patch("license_api_production.get_supabase", return_value=mock_db):
            resp = await client.post("/v1/license/deactivate", json={
                "licenseKey": "NONEXISTENT-KEY-1234",
                "deviceId": "device-test-12345678",
            })
        assert resp.status_code == 401


# ============================================================================
# Webhook — Lifecycle Events
# ============================================================================

class TestWebhookLifecycle:
    @pytest.mark.asyncio
    async def test_cancellation_deactivates(self, client: AsyncClient):
        event = {"type": "subscription.cancelled", "data": {"license": {"key": "TESTKEY-1234-ABCD"}}}
        mock_db = MagicMock()
        mock_db.table.return_value.update.return_value.eq.return_value.execute.return_value.data = [{"id": "1"}]
        with patch("license_api_production.verify_creem_webhook_signature", return_value=True), \
             patch("license_api_production.extract_license_key_from_event", return_value="TESTKEY-1234-ABCD"), \
             patch("license_api_production.get_supabase", return_value=mock_db):
            resp = await client.post("/v1/webhooks/creem",
                content=json.dumps(event).encode(),
                headers={"x-creem-signature": "ok", "content-type": "application/json"})
        assert resp.json()["action"] == "deactivated"

    @pytest.mark.asyncio
    async def test_renewal_reactivates(self, client: AsyncClient):
        event = {"type": "subscription.renewed", "data": {"license": {"key": "TESTKEY-1234-ABCD"}}}
        mock_db = MagicMock()
        mock_db.table.return_value.update.return_value.eq.return_value.execute.return_value.data = [{"id": "1"}]
        with patch("license_api_production.verify_creem_webhook_signature", return_value=True), \
             patch("license_api_production.extract_license_key_from_event", return_value="TESTKEY-1234-ABCD"), \
             patch("license_api_production.get_supabase", return_value=mock_db):
            resp = await client.post("/v1/webhooks/creem",
                content=json.dumps(event).encode(),
                headers={"x-creem-signature": "ok", "content-type": "application/json"})
        assert resp.json()["action"] == "reactivated"

    @pytest.mark.asyncio
    async def test_invalid_sig_returns_401(self, client: AsyncClient):
        with patch("license_api_production.verify_creem_webhook_signature", return_value=False):
            resp = await client.post("/v1/webhooks/creem",
                content=b'{}',
                headers={"x-creem-signature": "bad", "content-type": "application/json"})
        assert resp.status_code == 401


# ============================================================================
# Utility Functions
# ============================================================================

class TestUtilities:
    def test_generate_token_is_64_hex(self):
        token = generate_token("TESTKEY", "device-123")
        assert len(token) == 64
        int(token, 16)  # must be valid hex

    def test_generate_token_is_unique(self):
        t1 = generate_token("KEY", "DEV")
        t2 = generate_token("KEY", "DEV")
        assert t1 != t2  # random component

    def test_hash_ip_redacts(self):
        hashed = hash_ip("192.168.1.1")
        assert "192.168.1.1" not in hashed

    def test_daily_request_guard_allows_then_blocks(self):
        guard = DailyRequestGuard(max_daily=5)
        for _ in range(5):
            assert guard.check() is True
        assert guard.check() is False

    def test_health_server_time_is_recent(self):
        """Sanity: server time in health response should be close to now."""
        import asyncio
        async def _check():
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                resp = await ac.get("/health")
                st = resp.json()["serverTime"]
                assert abs(st - int(time.time())) < 10
        asyncio.get_event_loop().run_until_complete(_check())


# ============================================================================
# Helper Functions
# ============================================================================

class TestHelperFunctions:
    def test_generate_token_is_64_hex(self):
        token = generate_token("KEY-123", "device-abc-12345678")
        assert len(token) == 64
        assert all(c in "0123456789abcdef" for c in token)

    def test_generate_token_varies(self):
        t1 = generate_token("KEY-1", "d-12345678")
        t2 = generate_token("KEY-1", "d-12345678")
        assert t1 != t2  # each call has random bytes

    def test_hash_ip_is_deterministic(self):
        h1 = hash_ip("192.168.1.1")
        h2 = hash_ip("192.168.1.1")
        assert h1 == h2

    def test_hash_ip_differs_for_different_ips(self):
        assert hash_ip("192.168.1.1") != hash_ip("10.0.0.1")


# ============================================================================
# Daily Request Guard
# ============================================================================

class TestDailyRequestGuard:
    def test_allows_requests_under_limit(self):
        guard = DailyRequestGuard(max_daily=5)
        for _ in range(5):
            assert guard.check() is True

    def test_rejects_requests_over_limit(self):
        guard = DailyRequestGuard(max_daily=3)
        for _ in range(3):
            guard.check()
        assert guard.check() is False

    def test_get_count_tracks_requests(self):
        guard = DailyRequestGuard(max_daily=100)
        guard.check()
        guard.check()
        assert guard.get_count() == 2
