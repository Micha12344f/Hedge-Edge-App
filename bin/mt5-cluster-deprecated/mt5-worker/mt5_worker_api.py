"""
MT5 Worker API - Individual MT5 connection handler
Each worker can handle ONE MT5 connection at a time.
"""
import os
import time
import threading
from flask import Flask, request, jsonify
from flask_cors import CORS

# MT5 will be imported when running in Wine
try:
    import MetaTrader5 as mt5
    MT5_AVAILABLE = True
except ImportError:
    MT5_AVAILABLE = False
    print("WARNING: MetaTrader5 module not available")

app = Flask(__name__)
CORS(app)

# Worker configuration
WORKER_ID = os.environ.get('WORKER_ID', '1')
MT5_PATH = os.environ.get('MT5_PATH', "C:/Program Files/MetaTrader 5/terminal64.exe")

# Connection state
connection_state = {
    "connected": False,
    "login": None,
    "server": None,
    "connected_at": None,
    "last_activity": None
}
state_lock = threading.Lock()


def update_activity():
    """Update last activity timestamp"""
    with state_lock:
        connection_state["last_activity"] = time.time()


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "service": "mt5-worker",
        "worker_id": WORKER_ID,
        "mt5_available": MT5_AVAILABLE,
        "connected": connection_state["connected"],
        "current_login": connection_state["login"]
    })


@app.route('/api/status', methods=['GET'])
def status():
    """Get detailed worker status"""
    with state_lock:
        return jsonify({
            "success": True,
            "worker_id": WORKER_ID,
            "mt5_available": MT5_AVAILABLE,
            "connection": {
                "connected": connection_state["connected"],
                "login": connection_state["login"],
                "server": connection_state["server"],
                "connected_at": connection_state["connected_at"],
                "last_activity": connection_state["last_activity"]
            }
        })


@app.route('/api/connect', methods=['POST'])
def connect():
    """Connect to MT5 with provided credentials"""
    if not MT5_AVAILABLE:
        return jsonify({"success": False, "error": "MT5 module not available"}), 500
    
    data = request.json or {}
    login = data.get('login')
    password = data.get('password')
    server = data.get('server')
    
    if not all([login, password, server]):
        return jsonify({"success": False, "error": "Missing login, password or server"}), 400
    
    # Check if already connected to different account
    with state_lock:
        if connection_state["connected"] and connection_state["login"] != int(login):
            return jsonify({
                "success": False, 
                "error": f"Worker already connected to account {connection_state['login']}. Disconnect first."
            }), 409
    
    # Initialize MT5
    if not mt5.initialize(MT5_PATH):
        error = mt5.last_error()
        return jsonify({"success": False, "error": f"MT5 init failed: {error}"}), 500
    
    # Login
    authorized = mt5.login(login=int(login), password=password, server=server)
    if not authorized:
        error = mt5.last_error()
        mt5.shutdown()
        return jsonify({"success": False, "error": f"Login failed: {error}"}), 401
    
    # Update state
    with state_lock:
        connection_state["connected"] = True
        connection_state["login"] = int(login)
        connection_state["server"] = server
        connection_state["connected_at"] = time.time()
        connection_state["last_activity"] = time.time()
    
    return jsonify({
        "success": True, 
        "message": "Connected to MT5",
        "worker_id": WORKER_ID,
        "login": int(login),
        "server": server
    })


@app.route('/api/disconnect', methods=['POST'])
def disconnect():
    """Disconnect from MT5"""
    if MT5_AVAILABLE:
        mt5.shutdown()
    
    with state_lock:
        connection_state["connected"] = False
        connection_state["login"] = None
        connection_state["server"] = None
        connection_state["connected_at"] = None
        connection_state["last_activity"] = None
    
    return jsonify({"success": True, "message": "Disconnected"})


@app.route('/api/account/info', methods=['GET'])
def account_info():
    """Get account information"""
    if not MT5_AVAILABLE:
        return jsonify({"success": False, "error": "MT5 not available"}), 500
    
    update_activity()
    
    info = mt5.account_info()
    if info is None:
        return jsonify({"success": False, "error": "Not connected or failed to get account info"}), 400
    
    return jsonify({
        "success": True,
        "data": {
            "login": info.login,
            "balance": info.balance,
            "equity": info.equity,
            "margin": info.margin,
            "free_margin": info.margin_free,
            "leverage": info.leverage,
            "currency": info.currency,
            "server": info.server,
            "name": info.name,
            "company": info.company if hasattr(info, 'company') else None
        }
    })


@app.route('/api/positions', methods=['GET'])
def get_positions():
    """Get open positions"""
    if not MT5_AVAILABLE:
        return jsonify({"success": False, "error": "MT5 not available"}), 500
    
    update_activity()
    
    positions = mt5.positions_get()
    if positions is None:
        return jsonify({"success": True, "data": []})
    
    result = []
    for pos in positions:
        result.append({
            "ticket": pos.ticket,
            "symbol": pos.symbol,
            "type": "buy" if pos.type == 0 else "sell",
            "volume": pos.volume,
            "open_price": pos.price_open,
            "current_price": pos.price_current,
            "profit": pos.profit,
            "swap": pos.swap,
            "sl": pos.sl,
            "tp": pos.tp,
            "time": pos.time,
            "magic": pos.magic,
            "comment": pos.comment
        })
    
    return jsonify({"success": True, "data": result})


@app.route('/api/orders', methods=['GET'])
def get_orders():
    """Get pending orders"""
    if not MT5_AVAILABLE:
        return jsonify({"success": False, "error": "MT5 not available"}), 500
    
    update_activity()
    
    orders = mt5.orders_get()
    if orders is None:
        return jsonify({"success": True, "data": []})
    
    result = []
    for order in orders:
        result.append({
            "ticket": order.ticket,
            "symbol": order.symbol,
            "type": order.type,
            "volume": order.volume_current,
            "price": order.price_open,
            "sl": order.sl,
            "tp": order.tp,
            "time_setup": order.time_setup,
            "magic": order.magic,
            "comment": order.comment
        })
    
    return jsonify({"success": True, "data": result})


@app.route('/api/trade/open', methods=['POST'])
def open_trade():
    """Open a new trade"""
    if not MT5_AVAILABLE:
        return jsonify({"success": False, "error": "MT5 not available"}), 500
    
    update_activity()
    
    data = request.json or {}
    symbol = data.get('symbol')
    order_type = data.get('type', 'buy').lower()
    volume = float(data.get('volume', 0.01))
    sl = data.get('sl')
    tp = data.get('tp')
    comment = data.get('comment', 'API trade')
    magic = int(data.get('magic', 234000))
    
    if not symbol:
        return jsonify({"success": False, "error": "Symbol required"}), 400
    
    symbol_info = mt5.symbol_info(symbol)
    if symbol_info is None:
        return jsonify({"success": False, "error": f"Symbol {symbol} not found"}), 400
    
    if not symbol_info.visible:
        mt5.symbol_select(symbol, True)
    
    tick = mt5.symbol_info_tick(symbol)
    if tick is None:
        return jsonify({"success": False, "error": "Failed to get tick data"}), 400
    
    if order_type == 'buy':
        trade_type = mt5.ORDER_TYPE_BUY
        price = tick.ask
    else:
        trade_type = mt5.ORDER_TYPE_SELL
        price = tick.bid
    
    request_dict = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": symbol,
        "volume": volume,
        "type": trade_type,
        "price": price,
        "deviation": 20,
        "magic": magic,
        "comment": comment,
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": mt5.ORDER_FILLING_IOC,
    }
    
    if sl:
        request_dict["sl"] = float(sl)
    if tp:
        request_dict["tp"] = float(tp)
    
    result = mt5.order_send(request_dict)
    if result is None:
        return jsonify({"success": False, "error": "Order send returned None"}), 500
    
    if result.retcode != mt5.TRADE_RETCODE_DONE:
        return jsonify({
            "success": False, 
            "error": f"Trade failed: {result.comment}",
            "retcode": result.retcode
        }), 400
    
    return jsonify({
        "success": True,
        "data": {
            "ticket": result.order,
            "volume": result.volume,
            "price": result.price,
            "comment": result.comment
        }
    })


@app.route('/api/trade/close', methods=['POST'])
def close_trade():
    """Close an existing position"""
    if not MT5_AVAILABLE:
        return jsonify({"success": False, "error": "MT5 not available"}), 500
    
    update_activity()
    
    data = request.json or {}
    ticket = data.get('ticket')
    
    if not ticket:
        return jsonify({"success": False, "error": "Ticket required"}), 400
    
    position = mt5.positions_get(ticket=int(ticket))
    if not position:
        return jsonify({"success": False, "error": "Position not found"}), 404
    
    pos = position[0]
    
    # Determine close direction
    if pos.type == 0:  # Buy position
        trade_type = mt5.ORDER_TYPE_SELL
        price = mt5.symbol_info_tick(pos.symbol).bid
    else:  # Sell position
        trade_type = mt5.ORDER_TYPE_BUY
        price = mt5.symbol_info_tick(pos.symbol).ask
    
    request_dict = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": pos.symbol,
        "volume": pos.volume,
        "type": trade_type,
        "position": pos.ticket,
        "price": price,
        "deviation": 20,
        "magic": pos.magic,
        "comment": "API close",
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": mt5.ORDER_FILLING_IOC,
    }
    
    result = mt5.order_send(request_dict)
    if result is None:
        return jsonify({"success": False, "error": "Order send returned None"}), 500
    
    if result.retcode != mt5.TRADE_RETCODE_DONE:
        return jsonify({
            "success": False, 
            "error": f"Close failed: {result.comment}",
            "retcode": result.retcode
        }), 400
    
    return jsonify({"success": True, "message": "Position closed", "ticket": result.order})


@app.route('/api/tick', methods=['GET'])
def get_tick():
    """Get current tick data for a symbol"""
    if not MT5_AVAILABLE:
        return jsonify({"success": False, "error": "MT5 not available"}), 500
    
    update_activity()
    
    symbol = request.args.get('symbol', 'EURUSD')
    tick = mt5.symbol_info_tick(symbol)
    
    if tick is None:
        return jsonify({"success": False, "error": f"Failed to get tick for {symbol}"}), 400
    
    return jsonify({
        "success": True,
        "data": {
            "symbol": symbol,
            "bid": tick.bid,
            "ask": tick.ask,
            "spread": round((tick.ask - tick.bid) / mt5.symbol_info(symbol).point) if mt5.symbol_info(symbol) else None,
            "time": tick.time,
            "volume": tick.volume
        }
    })


@app.route('/api/symbols', methods=['GET'])
def get_symbols():
    """Get list of available symbols"""
    if not MT5_AVAILABLE:
        return jsonify({"success": False, "error": "MT5 not available"}), 500
    
    update_activity()
    
    group = request.args.get('group', None)
    
    if group:
        symbols = mt5.symbols_get(group=group)
    else:
        symbols = mt5.symbols_get()
    
    if symbols is None:
        return jsonify({"success": True, "data": []})
    
    return jsonify({
        "success": True,
        "data": [{"name": s.name, "visible": s.visible} for s in symbols]
    })


@app.route('/api/history/deals', methods=['GET'])
def get_deals():
    """Get deal history"""
    if not MT5_AVAILABLE:
        return jsonify({"success": False, "error": "MT5 not available"}), 500
    
    update_activity()
    
    from datetime import datetime, timedelta
    
    # Get deals from last 30 days by default
    days = int(request.args.get('days', 30))
    date_from = datetime.now() - timedelta(days=days)
    date_to = datetime.now()
    
    deals = mt5.history_deals_get(date_from, date_to)
    if deals is None:
        return jsonify({"success": True, "data": []})
    
    result = []
    for deal in deals:
        result.append({
            "ticket": deal.ticket,
            "order": deal.order,
            "time": deal.time,
            "type": deal.type,
            "entry": deal.entry,
            "symbol": deal.symbol,
            "volume": deal.volume,
            "price": deal.price,
            "profit": deal.profit,
            "swap": deal.swap,
            "commission": deal.commission,
            "magic": deal.magic,
            "comment": deal.comment
        })
    
    return jsonify({"success": True, "data": result})


if __name__ == '__main__':
    print(f"Starting MT5 Worker {WORKER_ID}")
    print(f"MT5 Path: {MT5_PATH}")
    print(f"MT5 Available: {MT5_AVAILABLE}")
    app.run(host='0.0.0.0', port=5000, threaded=True)
