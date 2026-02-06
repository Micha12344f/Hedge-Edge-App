"""
MT5 API Server
Flask REST API that connects to MetaTrader 5 and exposes account data.

Endpoints:
- GET /api/mt5/snapshot - Returns current account state, positions, and market ticks

Requirements:
- MetaTrader 5 terminal must be running
- Valid MT5 credentials in environment variables
"""

from flask import Flask, jsonify
from flask_cors import CORS
import MetaTrader5 as mt5
import os
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables from .env.mt5
load_dotenv('.env.mt5')

app = Flask(__name__)
CORS(app)  # Enable cross-origin requests from React


def initialize_mt5():
    """Initialize MT5 connection with credentials from environment"""
    # Get credentials from environment variables
    login = os.getenv('MT5_LOGIN')
    password = os.getenv('MT5_PASSWORD')
    server = os.getenv('MT5_SERVER')
    terminal_path = os.getenv('MT5_TERMINAL_PATH')
    
    if not login or not password or not server:
        print("Error: Missing MT5 credentials in environment variables")
        return False
    
    login = int(login)
    
    # Initialize MT5 terminal
    if terminal_path and os.path.exists(terminal_path):
        if not mt5.initialize(path=terminal_path):
            print(f"initialize() failed, error code = {mt5.last_error()}")
            return False
    else:
        if not mt5.initialize():
            print(f"initialize() failed, error code = {mt5.last_error()}")
            return False
    
    # Login to trading account
    authorized = mt5.login(login=login, password=password, server=server)
    if not authorized:
        print(f"login failed, error code = {mt5.last_error()}")
        mt5.shutdown()
        return False
    
    print(f"Connected to MT5 account {login} on {server}")
    return True


@app.route('/api/mt5/snapshot', methods=['GET'])
def get_mt5_snapshot():
    """Endpoint that returns current MT5 account state as JSON"""
    
    # Initialize MT5 connection
    if not initialize_mt5():
        return jsonify({'error': 'Failed to connect to MT5'}), 500
    
    try:
        # Get account information
        account_info = mt5.account_info()
        if account_info is None:
            return jsonify({'error': 'Failed to get account info'}), 500
        
        # Get open positions
        positions = mt5.positions_get()
        positions_list = []
        if positions:
            for pos in positions:
                positions_list.append({
                    'ticket': pos.ticket,
                    'symbol': pos.symbol,
                    'type': 'BUY' if pos.type == 0 else 'SELL',
                    'volume': pos.volume,
                    'price_open': pos.price_open,
                    'price_current': pos.price_current,
                    'profit': pos.profit,
                    'swap': getattr(pos, 'swap', 0),
                    'sl': pos.sl,
                    'tp': pos.tp,
                    'time': datetime.fromtimestamp(pos.time).isoformat(),
                    'magic': pos.magic,
                    'comment': getattr(pos, 'comment', '')
                })
        
        # Get pending orders
        orders = mt5.orders_get()
        orders_list = []
        if orders:
            for order in orders:
                order_types = {
                    0: 'BUY', 1: 'SELL', 2: 'BUY_LIMIT', 3: 'SELL_LIMIT',
                    4: 'BUY_STOP', 5: 'SELL_STOP', 6: 'BUY_STOP_LIMIT', 7: 'SELL_STOP_LIMIT'
                }
                orders_list.append({
                    'ticket': order.ticket,
                    'symbol': order.symbol,
                    'type': order_types.get(order.type, 'UNKNOWN'),
                    'volume': order.volume_current,
                    'price_open': order.price_open,
                    'sl': order.sl,
                    'tp': order.tp,
                    'time': datetime.fromtimestamp(order.time_setup).isoformat(),
                    'magic': order.magic,
                    'comment': order.comment
                })
        
        # Get market ticks for monitored symbols
        tickers = os.getenv('MT5_TICKERS', 'EURUSD').split(',')
        ticks = {}
        for symbol in tickers:
            symbol = symbol.strip()
            tick = mt5.symbol_info_tick(symbol)
            if tick:
                ticks[symbol] = {
                    'bid': tick.bid,
                    'ask': tick.ask,
                    'last': tick.last,
                    'volume': tick.volume,
                    'time': datetime.fromtimestamp(tick.time).isoformat()
                }
            else:
                # Try to enable the symbol first
                mt5.symbol_select(symbol, True)
                tick = mt5.symbol_info_tick(symbol)
                if tick:
                    ticks[symbol] = {
                        'bid': tick.bid,
                        'ask': tick.ask,
                        'last': tick.last,
                        'volume': tick.volume,
                        'time': datetime.fromtimestamp(tick.time).isoformat()
                    }
        
        # Build response
        snapshot = {
            'balance': account_info.balance,
            'equity': account_info.equity,
            'margin': account_info.margin,
            'margin_free': account_info.margin_free,
            'margin_level': account_info.margin_level if account_info.margin > 0 else None,
            'profit': account_info.profit,
            'leverage': account_info.leverage,
            'currency': account_info.currency,
            'server': account_info.server,
            'login': account_info.login,
            'positions': positions_list,
            'orders': orders_list,
            'ticks': ticks,
            'positions_count': len(positions_list),
            'orders_count': len(orders_list),
            'timestamp': datetime.now().isoformat()
        }
        
        return jsonify(snapshot), 200
        
    except Exception as e:
        print(f"Error in get_mt5_snapshot: {e}")
        return jsonify({'error': str(e)}), 500
    
    finally:
        # Clean up MT5 connection
        mt5.shutdown()


@app.route('/api/mt5/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'service': 'MT5 API Server',
        'timestamp': datetime.now().isoformat()
    }), 200


@app.route('/api/mt5/symbols', methods=['GET'])
def get_symbols():
    """Get list of available symbols"""
    if not initialize_mt5():
        return jsonify({'error': 'Failed to connect to MT5'}), 500
    
    try:
        symbols = mt5.symbols_get()
        if symbols:
            symbol_list = [{'name': s.name, 'description': s.description} for s in symbols[:100]]  # Limit to 100
            return jsonify({'symbols': symbol_list, 'total': len(symbols)}), 200
        return jsonify({'symbols': [], 'total': 0}), 200
    finally:
        mt5.shutdown()


if __name__ == '__main__':
    print("=" * 50)
    print("MT5 API Server Starting...")
    print("=" * 50)
    print(f"MT5 Login: {os.getenv('MT5_LOGIN')}")
    print(f"MT5 Server: {os.getenv('MT5_SERVER')}")
    print(f"Monitoring Tickers: {os.getenv('MT5_TICKERS')}")
    print("=" * 50)
    print("Endpoints:")
    print("  - http://localhost:5000/api/mt5/snapshot")
    print("  - http://localhost:5000/api/mt5/health")
    print("  - http://localhost:5000/api/mt5/symbols")
    print("=" * 50)
    app.run(host='0.0.0.0', port=5000, debug=False)
