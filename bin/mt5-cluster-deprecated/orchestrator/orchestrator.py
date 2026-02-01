"""
MT5 Cluster Orchestrator - Routes requests to available MT5 workers
"""
import os
import time
import json
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS
from session_manager import SessionManager

app = Flask(__name__)
CORS(app)

# Configuration
REDIS_URL = os.environ.get('REDIS_URL', 'redis://localhost:6379')
MAX_WORKERS = int(os.environ.get('MAX_CONTAINERS', 5))
IDLE_TIMEOUT = int(os.environ.get('IDLE_TIMEOUT_MINUTES', 30)) * 60

# Worker configuration - maps worker IDs to their internal URLs
WORKERS = {
    f"worker-{i}": {
        "id": i,
        "url": f"http://mt5-worker-{i}:5000",
        "external_port": 5000 + i
    }
    for i in range(1, MAX_WORKERS + 1)
}

session_manager = SessionManager(REDIS_URL, IDLE_TIMEOUT)


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    worker_status = {}
    for worker_id, worker in WORKERS.items():
        try:
            resp = requests.get(f"{worker['url']}/health", timeout=5)
            worker_status[worker_id] = resp.status_code == 200
        except:
            worker_status[worker_id] = False
    
    return jsonify({
        "status": "healthy",
        "service": "mt5-orchestrator",
        "workers": worker_status,
        "active_sessions": session_manager.get_active_session_count()
    })


@app.route('/api/workers', methods=['GET'])
def list_workers():
    """List all workers and their status"""
    workers_info = []
    for worker_id, worker in WORKERS.items():
        try:
            resp = requests.get(f"{worker['url']}/health", timeout=5)
            healthy = resp.status_code == 200
        except:
            healthy = False
        
        session = session_manager.get_worker_session(worker_id)
        workers_info.append({
            "id": worker_id,
            "port": worker["external_port"],
            "healthy": healthy,
            "in_use": session is not None,
            "user_id": session.get("user_id") if session else None,
            "mt5_login": session.get("mt5_login") if session else None
        })
    
    return jsonify({"success": True, "workers": workers_info})


@app.route('/api/session/allocate', methods=['POST'])
def allocate_session():
    """
    Allocate a worker for a user session.
    Request body: { "user_id": "uuid", "mt5_login": 12345, "mt5_server": "broker-server" }
    """
    data = request.json or {}
    user_id = data.get('user_id')
    mt5_login = data.get('mt5_login')
    mt5_server = data.get('mt5_server')
    
    if not user_id:
        return jsonify({"success": False, "error": "user_id required"}), 400
    
    # Check if user already has a session
    existing = session_manager.get_user_session(user_id)
    if existing:
        worker = WORKERS.get(existing['worker_id'])
        if worker:
            return jsonify({
                "success": True,
                "worker_id": existing['worker_id'],
                "worker_url": worker['url'],
                "external_port": worker['external_port'],
                "message": "Existing session found"
            })
    
    # Find available worker
    available_worker = None
    for worker_id, worker in WORKERS.items():
        if not session_manager.is_worker_in_use(worker_id):
            # Check if worker is healthy
            try:
                resp = requests.get(f"{worker['url']}/health", timeout=5)
                if resp.status_code == 200:
                    available_worker = (worker_id, worker)
                    break
            except:
                continue
    
    if not available_worker:
        return jsonify({
            "success": False, 
            "error": "No workers available. Please try again later.",
            "queue_position": session_manager.get_queue_position(user_id)
        }), 503
    
    worker_id, worker = available_worker
    
    # Create session
    session_manager.create_session(
        user_id=user_id,
        worker_id=worker_id,
        mt5_login=mt5_login,
        mt5_server=mt5_server
    )
    
    return jsonify({
        "success": True,
        "worker_id": worker_id,
        "worker_url": worker['url'],
        "external_port": worker['external_port'],
        "message": "Worker allocated"
    })


@app.route('/api/session/release', methods=['POST'])
def release_session():
    """
    Release a worker session.
    Request body: { "user_id": "uuid" }
    """
    data = request.json or {}
    user_id = data.get('user_id')
    
    if not user_id:
        return jsonify({"success": False, "error": "user_id required"}), 400
    
    session = session_manager.get_user_session(user_id)
    if not session:
        return jsonify({"success": False, "error": "No active session"}), 404
    
    # Disconnect from MT5 on the worker
    worker = WORKERS.get(session['worker_id'])
    if worker:
        try:
            requests.post(f"{worker['url']}/api/disconnect", timeout=10)
        except:
            pass
    
    session_manager.release_session(user_id)
    
    return jsonify({"success": True, "message": "Session released"})


@app.route('/api/session/status', methods=['GET'])
def session_status():
    """Get status of a user's session"""
    user_id = request.args.get('user_id')
    
    if not user_id:
        return jsonify({"success": False, "error": "user_id required"}), 400
    
    session = session_manager.get_user_session(user_id)
    if not session:
        return jsonify({
            "success": True,
            "has_session": False
        })
    
    worker = WORKERS.get(session['worker_id'])
    return jsonify({
        "success": True,
        "has_session": True,
        "worker_id": session['worker_id'],
        "external_port": worker['external_port'] if worker else None,
        "mt5_login": session.get('mt5_login'),
        "created_at": session.get('created_at'),
        "last_activity": session.get('last_activity')
    })


# ===========================================
# Proxy endpoints - route to assigned worker
# ===========================================

def proxy_to_worker(user_id, method, endpoint, data=None, params=None):
    """Proxy a request to the user's assigned worker"""
    session = session_manager.get_user_session(user_id)
    if not session:
        return jsonify({"success": False, "error": "No active session. Call /api/session/allocate first"}), 401
    
    worker = WORKERS.get(session['worker_id'])
    if not worker:
        return jsonify({"success": False, "error": "Worker not found"}), 500
    
    # Update activity timestamp
    session_manager.update_activity(user_id)
    
    try:
        url = f"{worker['url']}{endpoint}"
        if method == 'GET':
            resp = requests.get(url, params=params, timeout=30)
        elif method == 'POST':
            resp = requests.post(url, json=data, timeout=30)
        else:
            return jsonify({"success": False, "error": "Invalid method"}), 400
        
        return jsonify(resp.json()), resp.status_code
    except requests.exceptions.Timeout:
        return jsonify({"success": False, "error": "Worker timeout"}), 504
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/connect', methods=['POST'])
def connect():
    """Connect to MT5 - proxied to user's worker"""
    data = request.json or {}
    user_id = data.get('user_id')
    
    if not user_id:
        return jsonify({"success": False, "error": "user_id required"}), 400
    
    # Auto-allocate if no session
    session = session_manager.get_user_session(user_id)
    if not session:
        # Allocate first
        alloc_response = allocate_session()
        if isinstance(alloc_response, tuple):
            return alloc_response
        alloc_data = alloc_response.get_json()
        if not alloc_data.get('success'):
            return alloc_response
    
    return proxy_to_worker(user_id, 'POST', '/api/connect', data)


@app.route('/api/disconnect', methods=['POST'])
def disconnect():
    """Disconnect from MT5 and release session"""
    data = request.json or {}
    user_id = data.get('user_id')
    
    if not user_id:
        return jsonify({"success": False, "error": "user_id required"}), 400
    
    result = proxy_to_worker(user_id, 'POST', '/api/disconnect', data)
    
    # Release the session
    session_manager.release_session(user_id)
    
    return result


@app.route('/api/account/info', methods=['GET'])
def account_info():
    """Get account info - proxied to user's worker"""
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({"success": False, "error": "user_id required"}), 400
    return proxy_to_worker(user_id, 'GET', '/api/account/info')


@app.route('/api/positions', methods=['GET'])
def positions():
    """Get positions - proxied to user's worker"""
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({"success": False, "error": "user_id required"}), 400
    return proxy_to_worker(user_id, 'GET', '/api/positions')


@app.route('/api/orders', methods=['GET'])
def orders():
    """Get orders - proxied to user's worker"""
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({"success": False, "error": "user_id required"}), 400
    return proxy_to_worker(user_id, 'GET', '/api/orders')


@app.route('/api/trade/open', methods=['POST'])
def open_trade():
    """Open trade - proxied to user's worker"""
    data = request.json or {}
    user_id = data.get('user_id')
    if not user_id:
        return jsonify({"success": False, "error": "user_id required"}), 400
    return proxy_to_worker(user_id, 'POST', '/api/trade/open', data)


@app.route('/api/trade/close', methods=['POST'])
def close_trade():
    """Close trade - proxied to user's worker"""
    data = request.json or {}
    user_id = data.get('user_id')
    if not user_id:
        return jsonify({"success": False, "error": "user_id required"}), 400
    return proxy_to_worker(user_id, 'POST', '/api/trade/close', data)


@app.route('/api/tick', methods=['GET'])
def tick():
    """Get tick data - proxied to user's worker"""
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({"success": False, "error": "user_id required"}), 400
    symbol = request.args.get('symbol', 'EURUSD')
    return proxy_to_worker(user_id, 'GET', '/api/tick', params={'symbol': symbol})


@app.route('/api/symbols', methods=['GET'])
def symbols():
    """Get symbols - proxied to user's worker"""
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({"success": False, "error": "user_id required"}), 400
    return proxy_to_worker(user_id, 'GET', '/api/symbols')


# ===========================================
# Background cleanup task
# ===========================================

def cleanup_idle_sessions():
    """Clean up sessions that have been idle too long"""
    idle_sessions = session_manager.get_idle_sessions()
    for session in idle_sessions:
        user_id = session['user_id']
        worker = WORKERS.get(session['worker_id'])
        
        # Disconnect from MT5
        if worker:
            try:
                requests.post(f"{worker['url']}/api/disconnect", timeout=10)
            except:
                pass
        
        # Release session
        session_manager.release_session(user_id)
        print(f"Cleaned up idle session for user {user_id}")


if __name__ == '__main__':
    # SECURITY: Debug mode controlled by environment variable, defaults to False
    debug_mode = os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'
    app.run(host='0.0.0.0', port=5000, debug=debug_mode)
