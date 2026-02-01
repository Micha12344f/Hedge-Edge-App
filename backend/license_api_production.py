"""
Hedge Edge License Validation API - Production Server
======================================================

A FastAPI-based license validation service for MT4/MT5/cTrader agents.
Deployed at: api.hedge-edge.com

Features:
- License key validation with device tracking
- Session token management with heartbeat
- Rate limiting (100 req/min per IP)
- Supabase PostgreSQL integration
- Comprehensive logging and monitoring

Endpoints:
- POST /v1/license/validate - Validate license key and issue session token
- POST /v1/license/heartbeat - Refresh session token and report status
- POST /v1/license/deactivate - Deactivate device to free up slot
- GET /health - Health check endpoint
- GET /v1/license/status - Server status and statistics
"""

import os
import logging
import secrets
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Any
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# ============================================================================
# Configuration
# ============================================================================

class Config:
    """Application configuration"""
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_SERVICE_KEY: str = os.getenv("SUPABASE_SERVICE_KEY", "")
    
    # Rate limiting
    RATE_LIMIT: str = os.getenv("RATE_LIMIT", "100/minute")
    
    # Token settings
    TOKEN_TTL_SECONDS: int = int(os.getenv("TOKEN_TTL_SECONDS", "3600"))
    TOKEN_REFRESH_THRESHOLD: int = int(os.getenv("TOKEN_REFRESH_THRESHOLD", "300"))
    
    # Logging
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    
    # API settings
    API_VERSION: str = "1.0.0"
    API_TITLE: str = "Hedge Edge License API"

config = Config()

# ============================================================================
# Logging Setup
# ============================================================================

logging.basicConfig(
    level=getattr(logging, config.LOG_LEVEL),
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("license_api")

# ============================================================================
# Rate Limiter Setup
# ============================================================================

limiter = Limiter(key_func=get_remote_address)

# ============================================================================
# Supabase Client
# ============================================================================

supabase: Optional[Client] = None

def get_supabase() -> Client:
    """Get Supabase client, initializing if needed"""
    global supabase
    if supabase is None:
        if not config.SUPABASE_URL or not config.SUPABASE_SERVICE_KEY:
            raise HTTPException(
                status_code=500,
                detail="Database configuration missing"
            )
        supabase = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY)
    return supabase

# ============================================================================
# Pydantic Models
# ============================================================================

class ValidateRequest(BaseModel):
    """License validation request body"""
    licenseKey: str = Field(..., min_length=8, max_length=64, description="License key to validate")
    deviceId: str = Field(..., min_length=8, max_length=255, description="Unique device identifier")
    platform: str = Field(default="unknown", description="Platform type")
    accountId: Optional[str] = Field(default=None, max_length=100, description="Broker account ID")
    broker: Optional[str] = Field(default=None, max_length=100, description="Broker name")
    version: Optional[str] = Field(default="0.0.0", max_length=20, description="Agent version")
    
    @field_validator('platform')
    @classmethod
    def validate_platform(cls, v: str) -> str:
        allowed = ['mt4', 'mt5', 'ctrader', 'desktop', 'unknown']
        return v.lower() if v.lower() in allowed else 'unknown'
    
    @field_validator('licenseKey')
    @classmethod
    def normalize_license_key(cls, v: str) -> str:
        return v.upper().strip()


class ValidateSuccessResponse(BaseModel):
    """Successful validation response"""
    valid: bool = True
    token: str = Field(..., description="Session token (64 chars)")
    ttlSeconds: int = Field(..., description="Token time-to-live in seconds")
    plan: str = Field(..., description="License plan type")
    features: List[str] = Field(..., description="Enabled features")
    expiresAt: str = Field(..., description="License expiration date (ISO format)")
    email: Optional[str] = None
    devicesUsed: int = Field(default=1, description="Number of active devices")
    maxDevices: int = Field(default=1, description="Maximum allowed devices")


class ValidateErrorResponse(BaseModel):
    """Failed validation response"""
    valid: bool = False
    message: str = Field(..., description="Error description")
    code: str = Field(..., description="Error code")


class HeartbeatRequest(BaseModel):
    """Heartbeat request body"""
    token: str = Field(..., min_length=64, max_length=64, description="Current session token")
    deviceId: str = Field(..., min_length=8, max_length=255, description="Device identifier")
    status: Optional[dict] = Field(default=None, description="Optional status data")


class HeartbeatResponse(BaseModel):
    """Heartbeat response"""
    valid: bool = True
    newToken: Optional[str] = Field(default=None, description="Refreshed token if near expiry")
    ttlSeconds: int = Field(..., description="Remaining or new TTL")


class DeactivateRequest(BaseModel):
    """Device deactivation request"""
    licenseKey: str = Field(..., min_length=8, max_length=64)
    deviceId: str = Field(..., min_length=8, max_length=255)
    
    @field_validator('licenseKey')
    @classmethod
    def normalize_license_key(cls, v: str) -> str:
        return v.upper().strip()


class DeactivateResponse(BaseModel):
    """Deactivation response"""
    success: bool = True
    devicesRemaining: int = Field(..., description="Number of devices still registered")


class StatusResponse(BaseModel):
    """Server status response"""
    status: str = "online"
    timestamp: str
    version: str
    activeLicenses: int = 0
    totalDevices: int = 0


# ============================================================================
# Helper Functions
# ============================================================================

def generate_token(license_key: str, device_id: str) -> str:
    """Generate a secure session token"""
    random_bytes = secrets.token_bytes(32)
    payload = f"{license_key}:{device_id}:{datetime.now(timezone.utc).isoformat()}".encode()
    combined = random_bytes + payload
    return hashlib.sha256(combined).hexdigest()


def get_client_ip(request: Request) -> str:
    """Get the real client IP, handling proxies"""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def log_validation_attempt(
    db: Client,
    license_key: str,
    device_id: str,
    platform: str,
    ip_address: str,
    success: bool,
    error_code: Optional[str] = None,
    error_message: Optional[str] = None,
    request_data: Optional[dict] = None
):
    """Log a validation attempt to the database"""
    try:
        db.table("license_validation_logs").insert({
            "license_key": license_key[:20] + "..." if len(license_key) > 20 else license_key,
            "device_id": device_id[:50] + "..." if len(device_id) > 50 else device_id,
            "platform": platform,
            "ip_address": ip_address,
            "success": success,
            "error_code": error_code,
            "error_message": error_message,
            "request_data": request_data
        }).execute()
    except Exception as e:
        logger.error(f"Failed to log validation attempt: {e}")


# ============================================================================
# Application Lifecycle
# ============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown"""
    logger.info(f"Starting {config.API_TITLE} v{config.API_VERSION}")
    logger.info(f"Rate limit: {config.RATE_LIMIT}")
    
    # Validate configuration
    if not config.SUPABASE_URL or not config.SUPABASE_SERVICE_KEY:
        logger.warning("Supabase not configured - running in mock mode")
    else:
        logger.info("Supabase connection configured")
    
    yield
    
    logger.info("Shutting down License API")


# ============================================================================
# FastAPI Application
# ============================================================================

app = FastAPI(
    title=config.API_TITLE,
    description="License validation API for Hedge Edge trading agents",
    version=config.API_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Add rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:*",
        "http://127.0.0.1:*",
        "https://*.hedge-edge.com",
        "app://.",  # Electron app
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"]
)


# ============================================================================
# Error Handlers
# ============================================================================

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Custom HTTP exception handler"""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "valid": False,
            "message": exc.detail,
            "code": f"HTTP_{exc.status_code}"
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """General exception handler"""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "valid": False,
            "message": "Internal server error",
            "code": "ERROR_INTERNAL"
        }
    )


# ============================================================================
# Health & Status Endpoints
# ============================================================================

@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint for load balancers"""
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}


@app.get("/v1/license/status", response_model=StatusResponse, tags=["Status"])
@limiter.limit(config.RATE_LIMIT)
async def license_status(request: Request):
    """Get server status and statistics"""
    try:
        db = get_supabase()
        
        # Count active licenses
        licenses_result = db.table("licenses")\
            .select("id", count="exact")\
            .eq("is_active", True)\
            .execute()
        
        # Count active devices
        devices_result = db.table("license_devices")\
            .select("id", count="exact")\
            .eq("is_active", True)\
            .execute()
        
        return StatusResponse(
            status="online",
            timestamp=datetime.now(timezone.utc).isoformat(),
            version=config.API_VERSION,
            activeLicenses=licenses_result.count or 0,
            totalDevices=devices_result.count or 0
        )
    except Exception as e:
        logger.error(f"Status check failed: {e}")
        return StatusResponse(
            status="degraded",
            timestamp=datetime.now(timezone.utc).isoformat(),
            version=config.API_VERSION
        )


# ============================================================================
# License Validation Endpoint
# ============================================================================

@app.post("/v1/license/validate", tags=["License"])
@limiter.limit(config.RATE_LIMIT)
async def validate_license(request: Request, body: ValidateRequest):
    """
    Validate a license key and issue a session token.
    
    This endpoint validates the license key, checks device limits,
    and returns a session token for authenticated API access.
    """
    client_ip = get_client_ip(request)
    logger.info(f"Validation request - Key: {body.licenseKey[:8]}..., Device: {body.deviceId[:12]}..., Platform: {body.platform}, IP: {client_ip}")
    
    try:
        db = get_supabase()
        
        # Look up license
        license_result = db.table("licenses")\
            .select("*")\
            .eq("license_key", body.licenseKey)\
            .single()\
            .execute()
        
        if not license_result.data:
            logger.warning(f"Invalid license key: {body.licenseKey[:8]}...")
            await log_validation_attempt(
                db, body.licenseKey, body.deviceId, body.platform, client_ip,
                success=False, error_code="ERROR_INVALID_KEY", error_message="License key not found"
            )
            return JSONResponse(
                status_code=401,
                content={
                    "valid": False,
                    "message": "Invalid license key",
                    "code": "ERROR_INVALID_KEY"
                }
            )
        
        license_data = license_result.data
        
        # Check if license is active
        if not license_data.get("is_active", False):
            logger.warning(f"Inactive license: {body.licenseKey[:8]}...")
            await log_validation_attempt(
                db, body.licenseKey, body.deviceId, body.platform, client_ip,
                success=False, error_code="ERROR_INACTIVE", error_message="License is inactive"
            )
            return JSONResponse(
                status_code=403,
                content={
                    "valid": False,
                    "message": "License is inactive",
                    "code": "ERROR_INACTIVE"
                }
            )
        
        # Check expiration
        expires_at = datetime.fromisoformat(license_data["expires_at"].replace("Z", "+00:00"))
        if datetime.now(timezone.utc) > expires_at:
            logger.warning(f"Expired license: {body.licenseKey[:8]}...")
            await log_validation_attempt(
                db, body.licenseKey, body.deviceId, body.platform, client_ip,
                success=False, error_code="ERROR_EXPIRED", error_message="License has expired"
            )
            return JSONResponse(
                status_code=403,
                content={
                    "valid": False,
                    "message": "License has expired",
                    "code": "ERROR_EXPIRED",
                    "expiresAt": license_data["expires_at"]
                }
            )
        
        license_id = license_data["id"]
        max_devices = license_data.get("max_devices", 1)
        
        # Check if device is already registered
        device_result = db.table("license_devices")\
            .select("*")\
            .eq("license_id", license_id)\
            .eq("device_id", body.deviceId)\
            .eq("is_active", True)\
            .execute()
        
        if device_result.data:
            # Existing device - update last seen
            db.table("license_devices")\
                .update({
                    "last_seen_at": datetime.now(timezone.utc).isoformat(),
                    "platform": body.platform,
                    "version": body.version,
                    "account_id": body.accountId,
                    "broker": body.broker,
                    "ip_address": client_ip
                })\
                .eq("id", device_result.data[0]["id"])\
                .execute()
            
            logger.info(f"Existing device updated: {body.deviceId[:12]}...")
        else:
            # New device - check device limit
            active_devices_result = db.table("license_devices")\
                .select("id", count="exact")\
                .eq("license_id", license_id)\
                .eq("is_active", True)\
                .execute()
            
            active_count = active_devices_result.count or 0
            
            if active_count >= max_devices:
                logger.warning(f"Device limit reached: {active_count}/{max_devices}")
                await log_validation_attempt(
                    db, body.licenseKey, body.deviceId, body.platform, client_ip,
                    success=False, error_code="ERROR_DEVICE_LIMIT",
                    error_message=f"Device limit reached ({active_count}/{max_devices})"
                )
                return JSONResponse(
                    status_code=403,
                    content={
                        "valid": False,
                        "message": f"Device limit reached ({active_count}/{max_devices}). Deactivate another device first.",
                        "code": "ERROR_DEVICE_LIMIT",
                        "devicesUsed": active_count,
                        "maxDevices": max_devices
                    }
                )
            
            # Register new device
            db.table("license_devices").insert({
                "license_id": license_id,
                "device_id": body.deviceId,
                "platform": body.platform,
                "account_id": body.accountId,
                "broker": body.broker,
                "version": body.version,
                "ip_address": client_ip,
                "is_active": True
            }).execute()
            
            logger.info(f"New device registered: {body.deviceId[:12]}...")
        
        # Generate session token
        token = generate_token(body.licenseKey, body.deviceId)
        token_expires = datetime.now(timezone.utc) + timedelta(seconds=config.TOKEN_TTL_SECONDS)
        
        # Store session
        db.table("license_sessions").insert({
            "license_id": license_id,
            "device_id": body.deviceId,
            "token": token,
            "expires_at": token_expires.isoformat(),
            "ip_address": client_ip
        }).execute()
        
        # Get current device count
        final_devices_result = db.table("license_devices")\
            .select("id", count="exact")\
            .eq("license_id", license_id)\
            .eq("is_active", True)\
            .execute()
        
        devices_used = final_devices_result.count or 1
        
        # Log successful validation
        await log_validation_attempt(
            db, body.licenseKey, body.deviceId, body.platform, client_ip,
            success=True
        )
        
        logger.info(f"Validation successful: {body.licenseKey[:8]}... on {body.deviceId[:12]}...")
        
        return JSONResponse(
            status_code=200,
            content={
                "valid": True,
                "token": token,
                "ttlSeconds": config.TOKEN_TTL_SECONDS,
                "plan": license_data.get("plan", "demo"),
                "features": license_data.get("features", []),
                "expiresAt": license_data["expires_at"],
                "email": license_data.get("email"),
                "devicesUsed": devices_used,
                "maxDevices": max_devices
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Validation error: {e}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "valid": False,
                "message": "Internal server error",
                "code": "ERROR_INTERNAL"
            }
        )


# ============================================================================
# Heartbeat Endpoint
# ============================================================================

@app.post("/v1/license/heartbeat", response_model=HeartbeatResponse, tags=["License"])
@limiter.limit(config.RATE_LIMIT)
async def heartbeat(request: Request, body: HeartbeatRequest):
    """
    Refresh session token and report connection status.
    
    This endpoint should be called periodically to:
    1. Keep the session alive
    2. Report account status (balance, equity, positions)
    3. Get a refreshed token if near expiry
    """
    client_ip = get_client_ip(request)
    
    try:
        db = get_supabase()
        
        # Look up session
        session_result = db.table("license_sessions")\
            .select("*")\
            .eq("token", body.token)\
            .eq("device_id", body.deviceId)\
            .single()\
            .execute()
        
        if not session_result.data:
            logger.warning(f"Invalid session token: {body.token[:16]}...")
            raise HTTPException(status_code=401, detail="Invalid or expired session token")
        
        session_data = session_result.data
        expires_at = datetime.fromisoformat(session_data["expires_at"].replace("Z", "+00:00"))
        
        # Check if session expired
        if datetime.now(timezone.utc) > expires_at:
            logger.warning(f"Expired session: {body.token[:16]}...")
            # Clean up expired session
            db.table("license_sessions").delete().eq("id", session_data["id"]).execute()
            raise HTTPException(status_code=401, detail="Session expired, please re-validate")
        
        # Update heartbeat and status
        update_data = {
            "last_heartbeat_at": datetime.now(timezone.utc).isoformat(),
            "ip_address": client_ip
        }
        if body.status:
            update_data["status"] = body.status
        
        db.table("license_sessions")\
            .update(update_data)\
            .eq("id", session_data["id"])\
            .execute()
        
        # Also update device last seen
        db.table("license_devices")\
            .update({"last_seen_at": datetime.now(timezone.utc).isoformat()})\
            .eq("license_id", session_data["license_id"])\
            .eq("device_id", body.deviceId)\
            .execute()
        
        # Check if token needs refresh
        time_remaining = (expires_at - datetime.now(timezone.utc)).total_seconds()
        new_token = None
        ttl = int(time_remaining)
        
        if time_remaining < config.TOKEN_REFRESH_THRESHOLD:
            # Generate new token
            license_result = db.table("licenses")\
                .select("license_key")\
                .eq("id", session_data["license_id"])\
                .single()\
                .execute()
            
            if license_result.data:
                new_token = generate_token(license_result.data["license_key"], body.deviceId)
                new_expires = datetime.now(timezone.utc) + timedelta(seconds=config.TOKEN_TTL_SECONDS)
                
                # Update session with new token
                db.table("license_sessions")\
                    .update({
                        "token": new_token,
                        "expires_at": new_expires.isoformat()
                    })\
                    .eq("id", session_data["id"])\
                    .execute()
                
                ttl = config.TOKEN_TTL_SECONDS
                logger.info(f"Token refreshed for device: {body.deviceId[:12]}...")
        
        return HeartbeatResponse(
            valid=True,
            newToken=new_token,
            ttlSeconds=ttl
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Heartbeat error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


# ============================================================================
# Deactivation Endpoint
# ============================================================================

@app.post("/v1/license/deactivate", response_model=DeactivateResponse, tags=["License"])
@limiter.limit(config.RATE_LIMIT)
async def deactivate_device(request: Request, body: DeactivateRequest):
    """
    Deactivate a device to free up a license slot.
    
    This allows users to move their license to a different device
    without contacting support.
    """
    client_ip = get_client_ip(request)
    logger.info(f"Deactivation request - Key: {body.licenseKey[:8]}..., Device: {body.deviceId[:12]}...")
    
    try:
        db = get_supabase()
        
        # Look up license
        license_result = db.table("licenses")\
            .select("id")\
            .eq("license_key", body.licenseKey)\
            .single()\
            .execute()
        
        if not license_result.data:
            raise HTTPException(status_code=401, detail="Invalid license key")
        
        license_id = license_result.data["id"]
        
        # Find and deactivate the device
        device_result = db.table("license_devices")\
            .select("id")\
            .eq("license_id", license_id)\
            .eq("device_id", body.deviceId)\
            .eq("is_active", True)\
            .single()\
            .execute()
        
        if not device_result.data:
            raise HTTPException(status_code=404, detail="Device not found or already deactivated")
        
        # Deactivate device
        db.table("license_devices")\
            .update({
                "is_active": False,
                "deactivated_at": datetime.now(timezone.utc).isoformat()
            })\
            .eq("id", device_result.data["id"])\
            .execute()
        
        # Delete associated sessions
        db.table("license_sessions")\
            .delete()\
            .eq("license_id", license_id)\
            .eq("device_id", body.deviceId)\
            .execute()
        
        # Count remaining active devices
        remaining_result = db.table("license_devices")\
            .select("id", count="exact")\
            .eq("license_id", license_id)\
            .eq("is_active", True)\
            .execute()
        
        devices_remaining = remaining_result.count or 0
        
        logger.info(f"Device deactivated: {body.deviceId[:12]}... ({devices_remaining} devices remaining)")
        
        return DeactivateResponse(
            success=True,
            devicesRemaining=devices_remaining
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Deactivation error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


# ============================================================================
# Run Server (Development)
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "0.0.0.0")
    
    logger.info(f"Starting development server on {host}:{port}")
    
    uvicorn.run(
        "license_api_production:app",
        host=host,
        port=port,
        reload=True,
        log_level=config.LOG_LEVEL.lower()
    )
