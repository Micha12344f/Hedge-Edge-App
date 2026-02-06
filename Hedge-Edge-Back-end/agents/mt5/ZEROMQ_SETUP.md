# Hedge Edge ZeroMQ Communication Setup

## Overview

Hedge Edge now uses **ZeroMQ** as the **PRIMARY** communication method between the MT5 EA and the Desktop App. This provides sub-millisecond latency compared to the ~1 second latency of file-based communication.

```
┌─────────────────────────────────────────────────────────────────┐
│                    COMMUNICATION ARCHITECTURE                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   MT5 Terminal              ZeroMQ               Desktop App    │
│  ┌─────────────┐          ┌─────────┐          ┌─────────────┐ │
│  │  EA (PUB)   │──51810──►│   SUB   │◄────────►│   Electron  │ │
│  │  EA (REP)   │◄─51811──►│   REQ   │          │     App     │ │
│  └─────────────┘          └─────────┘          └─────────────┘ │
│                                                                 │
│   Latency: < 1ms (ZeroMQ) vs ~1000ms (File-based)              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Requirements

### MT5 Side (EA)

1. **libzmq.dll** - ZeroMQ C library (must be in `MQL5/Libraries/`)
2. **HedgeEdgeZMQ.mq5** - The new ZeroMQ-based EA
3. **ZMQ.mqh** - ZeroMQ MQL5 wrapper header

### Desktop App Side

1. **zeromq** npm package (already in package.json)
   ```bash
   npm install zeromq
   ```

## Installation

### Step 1: Install ZeroMQ DLL for MT5

1. Download `libzmq.dll` (64-bit) from the [ZeroMQ releases](https://github.com/zeromq/libzmq/releases)
   - You need `libzmq-v142-mt-4_3_5.dll` or similar
   - Rename it to `libzmq.dll`

2. Copy `libzmq.dll` to your MT5 Data Folder:
   ```
   %APPDATA%\MetaQuotes\Terminal\<YOUR_TERMINAL_ID>\MQL5\Libraries\libzmq.dll
   ```

3. Copy the EA files:
   ```
   agents/mt5/HedgeEdgeZMQ.mq5  →  MQL5/Experts/HedgeEdgeZMQ.mq5
   agents/mt5/ZMQ.mqh          →  MQL5/Include/ZMQ.mqh
   ```

4. Compile `HedgeEdgeZMQ.mq5` in MetaEditor

### Step 2: Configure the EA

| Parameter | Default | Description |
|-----------|---------|-------------|
| `InpZmqDataEndpoint` | `tcp://*:51810` | PUB socket for streaming data |
| `InpZmqCommandEndpoint` | `tcp://*:51811` | REP socket for commands |
| `InpPublishIntervalMs` | `100` | Snapshot interval (100ms = 10 updates/sec) |
| `InpDevMode` | `true` | Bypass license check for testing |

### Step 3: Verify Connection

In the desktop app logs, you should see:
```
[AgentChannelReader] Connecting to MT5 via ZeroMQ...
  Data endpoint: tcp://127.0.0.1:51810
  Command endpoint: tcp://127.0.0.1:51811
[AgentChannelReader] ✅ Connected to MT5 mt5-default via ZeroMQ
```

In MT5, the EA should show:
```
═══════════════════════════════════════════════════════════
  Hedge Edge ZMQ EA v2.0 - Starting...
═══════════════════════════════════════════════════════════
Initializing ZeroMQ...
  ZMQ Version: 4.3.5
  PUB socket bound to tcp://*:51810
  REP socket bound to tcp://*:51811
ZeroMQ initialized successfully
```

## Ports

| Port | Protocol | Direction | Purpose |
|------|----------|-----------|---------|
| 51810 | TCP | EA → App | Account snapshots (PUB/SUB) |
| 51811 | TCP | App ↔ EA | Commands & responses (REQ/REP) |

## Commands

The EA accepts these commands via ZeroMQ:

| Command | Description |
|---------|-------------|
| `PAUSE` | Pause data streaming |
| `RESUME` | Resume data streaming |
| `CLOSE_ALL` | Close all open positions |
| `CLOSE_POSITION` | Close specific position (requires `positionId`) |
| `STATUS` | Get current status snapshot |
| `PING` | Connectivity check |
| `CONFIG` | Get EA configuration |

### Example Command:
```json
{"action": "PAUSE"}
```

### Example Response:
```json
{
  "success": true,
  "action": "PAUSE",
  "message": "Trading paused",
  "timestamp": "2026.02.02 10:30:00"
}
```

## Troubleshooting

### "Failed to create ZMQ context"
- Ensure `libzmq.dll` is in `MQL5/Libraries/`
- Ensure it's the 64-bit version for MT5 (32-bit for MT4)
- Restart MT5 after adding the DLL

### "Address already in use"
- Another application is using port 51810 or 51811
- Check if another MT5 terminal is running the EA
- Change ports in EA parameters

### "ZeroMQ not available" (Desktop App)
- Run `npm install zeromq`
- Ensure native modules are built for your Electron version

### Connection Timeout
- Check Windows Firewall settings
- Ensure MT5 has DLL imports enabled (Tools → Options → Expert Advisors → Allow DLL imports)

## Performance

| Metric | File-Based | ZeroMQ |
|--------|------------|--------|
| Latency | ~1000ms | <1ms |
| Updates/sec | 1 | 10-100+ |
| Race conditions | Possible | None |
| CPU overhead | Low | Very low |

## Fallback Mode

If ZeroMQ is unavailable, the system falls back to file-based communication automatically. This is indicated in the snapshot response:

```json
{
  "zmqMode": false  // File fallback active
}
```

vs

```json
{
  "zmqMode": true   // ZeroMQ active
}
```
