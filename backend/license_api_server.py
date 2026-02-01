"""
Hedge Edge License Validation API Server (Development/Testing)

This is a local mock server for testing license validation.
In production, this would be hosted at api.hedge-edge.com

Run: python license_api_server.py
Endpoints:
- POST /v1/license/validate - Validate license key
- GET /v1/license/status - Check server status
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
from datetime import datetime, timedelta
import hashlib
import secrets
import json
import os

app = Flask(__name__)
CORS(app)

# ============================================================================
# Mock License Database (In production, this would be a real database)
# ============================================================================

# Valid test license keys
TEST_LICENSES = {
    "TEST-1234-5678-DEMO": {
        "plan": "demo",
        "email": "demo@test.com",
        "created": "2026-01-01",
        "expires": "2026-12-31",
        "max_devices": 1,
        "features": ["trade-copying", "hedge-detection"]
    },
    "73E0A88D-DAF0-4EC5-979B-236C3BF0C925": {
        "plan": "professional",
        "email": "user@hedge-edge.com",
        "created": "2026-01-01",
        "expires": "2027-12-31",
        "max_devices": 10,
        "features": ["trade-copying", "hedge-detection", "multi-account", "analytics", "api-access"]
    },
    "PROD-ABCD-EFGH-FULL": {
        "plan": "professional",
        "email": "pro@hedge-edge.com",
        "created": "2026-01-01",
        "expires": "2027-01-01",
        "max_devices": 3,
        "features": ["trade-copying", "hedge-detection", "multi-account", "analytics", "api-access"]
    },
    "ENTE-RPRS-TEAM-PLAN": {
        "plan": "enterprise",
        "email": "enterprise@company.com",
        "created": "2026-01-01",
        "expires": "2028-01-01",
        "max_devices": 50,
        "features": ["trade-copying", "hedge-detection", "multi-account", "analytics", "api-access", "priority-support", "custom-integrations"]
    }
}

# Device tracking (in production, stored in database)
DEVICE_REGISTRATIONS = {}

# Active tokens (in production, use Redis or similar)
ACTIVE_TOKENS = {}


def generate_token(license_key: str, device_id: str) -> str:
    """Generate a JWT-like token for the session"""
    payload = f"{license_key}:{device_id}:{datetime.now().isoformat()}"
    return hashlib.sha256(payload.encode()).hexdigest()[:64]


def get_device_count(license_key: str) -> int:
    """Count devices registered to a license"""
    return len(DEVICE_REGISTRATIONS.get(license_key, {}))


@app.route('/v1/license/validate', methods=['POST'])
def validate_license():
    """
    Validate a license key and device combination.
    
    Request Body:
    {
        "licenseKey": "XXXX-XXXX-XXXX-XXXX",
        "deviceId": "unique-device-hash",
        "platform": "desktop|mt5|ctrader",
        "version": "1.0.0"
    }
    
    Response:
    {
        "valid": true/false,
        "token": "session-token",
        "ttlSeconds": 3600,
        "message": "success/error message",
        "plan": "demo|professional|enterprise",
        "expiresAt": "2027-01-01T00:00:00Z"
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                "valid": False,
                "message": "Invalid request body"
            }), 400
        
        license_key = data.get('licenseKey', '').upper()
        device_id = data.get('deviceId', 'unknown')
        platform = data.get('platform', 'unknown')
        version = data.get('version', '0.0.0')
        
        print(f"[LICENSE] Validation request - Key: {license_key[:4]}..., Device: {device_id[:8]}..., Platform: {platform}")
        
        # Check if license exists
        if license_key not in TEST_LICENSES:
            print(f"[LICENSE] Invalid key: {license_key}")
            return jsonify({
                "valid": False,
                "message": "Invalid license key"
            }), 401
        
        license_info = TEST_LICENSES[license_key]
        
        # Check expiration
        expires = datetime.strptime(license_info['expires'], '%Y-%m-%d')
        if datetime.now() > expires:
            print(f"[LICENSE] Expired key: {license_key}")
            return jsonify({
                "valid": False,
                "message": "License has expired",
                "expiresAt": license_info['expires']
            }), 403
        
        # Check device limit
        if license_key not in DEVICE_REGISTRATIONS:
            DEVICE_REGISTRATIONS[license_key] = {}
        
        if device_id not in DEVICE_REGISTRATIONS[license_key]:
            current_devices = len(DEVICE_REGISTRATIONS[license_key])
            if current_devices >= license_info['max_devices']:
                print(f"[LICENSE] Device limit reached: {current_devices}/{license_info['max_devices']}")
                return jsonify({
                    "valid": False,
                    "message": f"Device limit reached ({current_devices}/{license_info['max_devices']}). Deactivate another device first."
                }), 403
            
            # Register new device
            DEVICE_REGISTRATIONS[license_key][device_id] = {
                "registered": datetime.now().isoformat(),
                "platform": platform,
                "version": version,
                "last_seen": datetime.now().isoformat()
            }
            print(f"[LICENSE] New device registered for {license_key[:4]}...")
        else:
            # Update last seen
            DEVICE_REGISTRATIONS[license_key][device_id]['last_seen'] = datetime.now().isoformat()
            DEVICE_REGISTRATIONS[license_key][device_id]['version'] = version
        
        # Generate session token
        token = generate_token(license_key, device_id)
        ttl_seconds = 3600  # 1 hour
        
        ACTIVE_TOKENS[token] = {
            "license_key": license_key,
            "device_id": device_id,
            "expires": datetime.now() + timedelta(seconds=ttl_seconds)
        }
        
        print(f"[LICENSE] Validated successfully: {license_key[:4]}... on {device_id[:8]}...")
        
        return jsonify({
            "valid": True,
            "token": token,
            "ttlSeconds": ttl_seconds,
            "message": "License validated successfully",
            "plan": license_info['plan'],
            "expiresAt": f"{license_info['expires']}T00:00:00Z",
            "features": license_info['features'],
            "email": license_info['email']
        }), 200
        
    except Exception as e:
        print(f"[LICENSE] Error: {str(e)}")
        return jsonify({
            "valid": False,
            "message": f"Server error: {str(e)}"
        }), 500


@app.route('/v1/license/status', methods=['GET'])
def license_status():
    """Get server status and statistics"""
    return jsonify({
        "status": "online",
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0",
        "active_licenses": len([k for k, v in DEVICE_REGISTRATIONS.items() if len(v) > 0]),
        "total_devices": sum(len(v) for v in DEVICE_REGISTRATIONS.values()),
        "test_keys_available": list(TEST_LICENSES.keys())
    }), 200


@app.route('/v1/license/devices', methods=['GET'])
def list_devices():
    """List registered devices (for admin/testing)"""
    return jsonify({
        "devices": DEVICE_REGISTRATIONS
    }), 200


@app.route('/v1/license/revoke', methods=['POST'])
def revoke_device():
    """Revoke a device registration"""
    data = request.get_json()
    license_key = data.get('licenseKey', '').upper()
    device_id = data.get('deviceId')
    
    if license_key in DEVICE_REGISTRATIONS:
        if device_id in DEVICE_REGISTRATIONS[license_key]:
            del DEVICE_REGISTRATIONS[license_key][device_id]
            return jsonify({"success": True, "message": "Device revoked"}), 200
    
    return jsonify({"success": False, "message": "Device not found"}), 404


if __name__ == '__main__':
    print("=" * 60)
    print("Hedge Edge License API Server (Development)")
    print("=" * 60)
    print("\nAvailable test license keys:")
    for key, info in TEST_LICENSES.items():
        print(f"  {key} - {info['plan']} (expires: {info['expires']})")
    print("\nEndpoints:")
    print("  POST http://localhost:5001/v1/license/validate")
    print("  GET  http://localhost:5001/v1/license/status")
    print("  GET  http://localhost:5001/v1/license/devices")
    print("  POST http://localhost:5001/v1/license/revoke")
    print("=" * 60)
    
    app.run(host='0.0.0.0', port=5001, debug=True)
