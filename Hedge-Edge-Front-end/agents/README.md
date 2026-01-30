# Bundled Trading Agents

This folder contains bundled trading agents for the HedgeEdge desktop app.

## Structure

```
agents/
├── mt5/
│   ├── mt5-agent.exe        (Windows)
│   └── mt5-agent            (macOS/Linux)
└── ctrader/
    ├── ctrader-agent.exe    (Windows)
    └── ctrader-agent        (macOS/Linux)
```

## Building Agents

The trading agents are Python applications that need to be packaged as standalone executables.

### Prerequisites

- Python 3.11+
- PyInstaller

### Building MT5 Agent

```bash
cd Hedge-Edge-Back-end
pip install -r requirements.txt
pip install pyinstaller

# Windows
pyinstaller --onefile --name mt5-agent mt5_api_server.py

# macOS/Linux
pyinstaller --onefile --name mt5-agent mt5_api_server.py
```

Copy the output from `dist/mt5-agent` (or `dist/mt5-agent.exe` on Windows) to this folder.

### For Development

During development, agents are typically not bundled. Instead:

1. Run the agent manually in a terminal
2. Or configure external agent host/port in the app

The app will detect when bundled agents are not available and show guidance.

## Default Ports

| Platform | Port |
|----------|------|
| MT5      | 5101 |
| cTrader  | 5102 |
