"""
MT5 VPS API Server - Multi-Account Support
==========================================
This server runs on your Windows VPS and provides API endpoints
for your web app to:
1. Validate MT5 credentials
2. Fetch account data for any connected account
3. Get positions and orders
4. Stream live market data

Deploy this on a Windows VPS with MT5 terminal installed.
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import MetaTrader5 as mt5
from functools import wraps
import os
import json
import time
import hashlib
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)  # Enable CORS for web app access

# =============================================================================
# CONFIGURATION
# =============================================================================

# API Key for securing endpoints (REQUIRED - set in .env or environment)
# SECURITY: No default value - server will fail to start without proper API key
API_KEY = os.getenv('MT5_API_KEY')
if not API_KEY:
    raise RuntimeError(
        'CRITICAL: MT5_API_KEY environment variable is required. '
        'Set a strong, unique API key in your .env file or environment.'
    )

# MT5 Terminal path (adjust for your VPS)
MT5_PATH = os.getenv('MT5_PATH', r"C:\Program Files\MetaTrader 5\terminal64.exe")

# Rate limiting (requests per minute per IP)
RATE_LIMIT = 60

# Cache for rate limiting
request_cache = {}

# =============================================================================
# SECURITY MIDDLEWARE
# =============================================================================

def require_api_key(f):
    """Decorator to require API key for protected endpoints"""
    @wraps(f)
    def decorated(*args, **kwargs):
        api_key = request.headers.get('X-API-Key') or request.args.get('api_key')
        if not api_key or api_key != API_KEY:
            return jsonify({
                'success': False,
                'error': 'Invalid or missing API key'
            }), 401
        return f(*args, **kwargs)
    return decorated


def rate_limit(f):
    """Simple rate limiting decorator"""
    @wraps(f)
    def decorated(*args, **kwargs):
        client_ip = request.remote_addr
        current_time = time.time()
        
        # Clean old entries
        request_cache[client_ip] = [
            t for t in request_cache.get(client_ip, [])
            if current_time - t < 60
        ]
        
        if len(request_cache.get(client_ip, [])) >= RATE_LIMIT:
            return jsonify({
                'success': False,
                'error': 'Rate limit exceeded. Try again later.'
            }), 429
        
        request_cache.setdefault(client_ip, []).append(current_time)
        return f(*args, **kwargs)
    return decorated


# =============================================================================
# MT5 CONNECTION HELPERS
# =============================================================================

def init_mt5():
    """Initialize MT5 connection"""
    if not mt5.initialize(MT5_PATH):
        return False, f"MT5 initialization failed: {mt5.last_error()}"
    return True, "OK"


def connect_account(login: int, password: str, server: str):
    """
    Connect to a specific MT5 account.
    This is the key function for validating credentials!
    """
    # First, initialize MT5
    success, msg = init_mt5()
    if not success:
        return False, msg, None
    
    # Try to login with provided credentials
    authorized = mt5.login(
        login=int(login),
        password=password,
        server=server
    )
    
    if not authorized:
        error = mt5.last_error()
        return False, f"Login failed: {error}", None
    
    # Get account info to confirm connection
    account_info = mt5.account_info()
    if account_info is None:
        return False, "Could not retrieve account info", None
    
    return True, "Connected successfully", account_info


def get_account_snapshot(login: int, password: str, server: str):
    """Get full account snapshot including positions"""
    success, msg, account_info = connect_account(login, password, server)
    
    if not success:
        return None, msg
    
    # Get positions
    positions = mt5.positions_get()
    positions_data = []
    
    if positions:
        for pos in positions:
            positions_data.append({
                'ticket': pos.ticket,
                'symbol': pos.symbol,
                'type': 'BUY' if pos.type == 0 else 'SELL',
                'volume': pos.volume,
                'price_open': pos.price_open,
                'price_current': pos.price_current,
                'profit': pos.profit,
                'swap': pos.swap,
                'commission': getattr(pos, 'commission', 0),
                'sl': pos.sl,
                'tp': pos.tp,
                'time': datetime.fromtimestamp(pos.time).isoformat(),
                'magic': pos.magic,
                'comment': pos.comment,
            })
    
    # Get pending orders
    orders = mt5.orders_get()
    orders_data = []
    
    if orders:
        for order in orders:
            orders_data.append({
                'ticket': order.ticket,
                'symbol': order.symbol,
                'type': order.type,
                'volume': order.volume_current,
                'price': order.price_open,
                'sl': order.sl,
                'tp': order.tp,
                'time': datetime.fromtimestamp(order.time_setup).isoformat(),
            })
    
    # Calculate totals
    total_profit = sum(p['profit'] + p['swap'] + p.get('commission', 0) for p in positions_data)
    
    snapshot = {
        'login': account_info.login,
        'server': account_info.server,
        'name': account_info.name,
        'broker': account_info.company,
        'currency': account_info.currency,
        'balance': account_info.balance,
        'equity': account_info.equity,
        'margin': account_info.margin,
        'margin_free': account_info.margin_free,
        'margin_level': account_info.margin_level,
        'profit': total_profit,
        'leverage': account_info.leverage,
        'positions': positions_data,
        'positions_count': len(positions_data),
        'orders': orders_data,
        'orders_count': len(orders_data),
        'timestamp': datetime.now().isoformat(),
    }
    
    return snapshot, None


# =============================================================================
# API ENDPOINTS
# =============================================================================

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint (no auth required)"""
    success, msg = init_mt5()
    return jsonify({
        'status': 'healthy' if success else 'unhealthy',
        'mt5_connected': success,
        'message': msg,
        'timestamp': datetime.now().isoformat()
    })


@app.route('/api/validate', methods=['POST'])
@require_api_key
@rate_limit
def validate_credentials():
    """
    Validate MT5 credentials without storing them.
    This is how your web app checks if credentials are valid!
    
    Request body:
    {
        "login": "12345678",
        "password": "your-password",
        "server": "FTMO-Demo"
    }
    """
    data = request.get_json()
    
    if not data:
        return jsonify({
            'success': False,
            'error': 'Request body required'
        }), 400
    
    login = data.get('login')
    password = data.get('password')
    server = data.get('server')
    
    if not all([login, password, server]):
        return jsonify({
            'success': False,
            'error': 'Missing required fields: login, password, server'
        }), 400
    
    # Try to connect
    success, msg, account_info = connect_account(login, password, server)
    
    if not success:
        return jsonify({
            'success': False,
            'error': msg,
            'valid': False
        })
    
    # Return account info on success (for auto-filling form fields)
    return jsonify({
        'success': True,
        'valid': True,
        'account': {
            'login': account_info.login,
            'name': account_info.name,
            'broker': account_info.company,
            'server': account_info.server,
            'currency': account_info.currency,
            'balance': account_info.balance,
            'equity': account_info.equity,
            'leverage': account_info.leverage,
        }
    })


@app.route('/api/account/snapshot', methods=['POST'])
@require_api_key
@rate_limit
def get_snapshot():
    """
    Get full account snapshot including positions and orders.
    
    Request body:
    {
        "login": "12345678",
        "password": "your-password",
        "server": "FTMO-Demo"
    }
    """
    data = request.get_json()
    
    if not data:
        return jsonify({
            'success': False,
            'error': 'Request body required'
        }), 400
    
    login = data.get('login')
    password = data.get('password')
    server = data.get('server')
    
    if not all([login, password, server]):
        return jsonify({
            'success': False,
            'error': 'Missing required fields: login, password, server'
        }), 400
    
    snapshot, error = get_account_snapshot(login, password, server)
    
    if error:
        return jsonify({
            'success': False,
            'error': error
        })
    
    return jsonify({
        'success': True,
        'data': snapshot
    })


@app.route('/api/account/balance', methods=['POST'])
@require_api_key
@rate_limit
def get_balance():
    """
    Get just the balance/equity (lighter than full snapshot).
    Good for frequent polling.
    """
    data = request.get_json()
    
    if not data:
        return jsonify({
            'success': False,
            'error': 'Request body required'
        }), 400
    
    login = data.get('login')
    password = data.get('password')
    server = data.get('server')
    
    if not all([login, password, server]):
        return jsonify({
            'success': False,
            'error': 'Missing required fields'
        }), 400
    
    success, msg, account_info = connect_account(login, password, server)
    
    if not success:
        return jsonify({
            'success': False,
            'error': msg
        })
    
    # Get positions for profit calculation
    positions = mt5.positions_get()
    total_profit = 0
    if positions:
        total_profit = sum(
            p.profit + p.swap + getattr(p, 'commission', 0) 
            for p in positions
        )
    
    return jsonify({
        'success': True,
        'data': {
            'login': account_info.login,
            'balance': account_info.balance,
            'equity': account_info.equity,
            'margin': account_info.margin,
            'margin_free': account_info.margin_free,
            'profit': total_profit,
            'positions_count': len(positions) if positions else 0,
            'timestamp': datetime.now().isoformat()
        }
    })


@app.route('/api/symbols', methods=['GET'])
@require_api_key
def get_symbols():
    """Get available trading symbols"""
    success, msg = init_mt5()
    if not success:
        return jsonify({'success': False, 'error': msg})
    
    symbols = mt5.symbols_get()
    if symbols is None:
        return jsonify({'success': False, 'error': 'Could not get symbols'})
    
    symbol_list = [s.name for s in symbols if s.visible]
    return jsonify({
        'success': True,
        'symbols': symbol_list[:100]  # Limit to 100 symbols
    })


@app.route('/api/tick', methods=['GET'])
@require_api_key
def get_tick():
    """Get current tick for a symbol"""
    symbol = request.args.get('symbol', 'EURUSD')
    
    success, msg = init_mt5()
    if not success:
        return jsonify({'success': False, 'error': msg})
    
    tick = mt5.symbol_info_tick(symbol)
    if tick is None:
        return jsonify({'success': False, 'error': f'Could not get tick for {symbol}'})
    
    return jsonify({
        'success': True,
        'data': {
            'symbol': symbol,
            'bid': tick.bid,
            'ask': tick.ask,
            'last': tick.last,
            'volume': tick.volume,
            'time': datetime.fromtimestamp(tick.time).isoformat()
        }
    })


# =============================================================================
# MAIN
# =============================================================================

if __name__ == '__main__':
    print("=" * 60)
    print("MT5 VPS API Server - Multi-Account")
    print("=" * 60)
    print(f"API Key: {API_KEY[:10]}..." if len(API_KEY) > 10 else f"API Key: {API_KEY}")
    print(f"MT5 Path: {MT5_PATH}")
    print("=" * 60)
    print("Endpoints:")
    print("  - GET  /api/health          - Health check (no auth)")
    print("  - POST /api/validate        - Validate MT5 credentials")
    print("  - POST /api/account/snapshot - Get full account data")
    print("  - POST /api/account/balance  - Get balance only (fast)")
    print("  - GET  /api/symbols         - List trading symbols")
    print("  - GET  /api/tick?symbol=X   - Get live tick")
    print("=" * 60)
    print("\nStarting server on http://0.0.0.0:5000")
    print("Make sure to:")
    print("  1. Set MT5_API_KEY in .env for production")
    print("  2. Use HTTPS in production (nginx reverse proxy)")
    print("=" * 60)
    
    # Initialize MT5 on startup
    success, msg = init_mt5()
    if success:
        print("✅ MT5 initialized successfully")
    else:
        print(f"⚠️ MT5 initialization: {msg}")
    
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)
