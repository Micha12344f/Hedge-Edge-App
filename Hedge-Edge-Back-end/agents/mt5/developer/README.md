# Hedge Edge MT5 Developer Files

## Overview
This folder contains the **editable MQL5 source files** for Hedge Edge Expert Advisors.
These are the master copies for development. Changes here should be compiled in MetaEditor
and then deployed to MT5 terminals.

## Files

| File | Purpose |
|------|---------|
| `HedgeEdgeZMQ.mq5` | **Primary EA** - ZeroMQ-based real-time streaming |
| `HedgeEdgeLicense.mq5` | Legacy EA - File-based IPC (Named Pipes) |
| `ZMQ.mqh` | ZeroMQ MQL5 wrapper (CZmqContext, CZmqPublisher, CZmqReplier) |
| `Sodium.mqh` | Encryption helper library |

## Compilation & Deployment Workflow

### 1. Edit Source
Edit `.mq5` files in this folder using VS Code or MetaEditor.

### 2. Compile to .ex5
1. Open MetaEditor (F4 from MT5 terminal)
2. Open the `.mq5` file from `MQL5/Experts/` folder
3. Press **F7** to compile → produces `.ex5` binary
4. Check the Errors tab: should show **0 errors**

### 3. Deploy .ex5 Only (Production)
For end users, distribute ONLY the `.ex5` compiled files:
- `.ex5` files cannot be decompiled (source-protected)
- Delete `.mq5` from the Experts folder on client machines
- Keep `libzmq.dll` in `MQL5/Libraries/`

## Dependencies

### Required in MQL5/Libraries/
- `libzmq.dll` (64-bit) - ZeroMQ runtime
- `HedgeEdgeLicense.dll` (optional) - License validation DLL

### Required in MQL5/Include/
- `ZMQ.mqh` - ZeroMQ wrapper
- `Sodium.mqh` - Encryption helper

## ZMQ Port Configuration (Multi-Terminal)

Each MT5 terminal needs **unique** ZMQ ports to avoid conflicts:

| Terminal | Data Port (PUB) | Command Port (REP) |
|----------|----------------|-------------------|
| Terminal 1 | tcp://*:51810 | tcp://*:51811 |
| Terminal 2 | tcp://*:51820 | tcp://*:51821 |
| Terminal 3 | tcp://*:51830 | tcp://*:51831 |
| Terminal 4 | tcp://*:51840 | tcp://*:51841 |
| Terminal 5 | tcp://*:51850 | tcp://*:51851 |

**IMPORTANT:** Ports must match the Electron app's scan ranges (10-port gaps).
The default EA settings are 51810/51811. For additional terminals, change the
ZMQ Data/Command Endpoint inputs in the EA properties dialog.

Set these in the EA input parameters when attaching to a chart.

## Troubleshooting

### "libzmq.dll not found"
Place `libzmq.dll` (64-bit) in `<MT5 Data>/MQL5/Libraries/`

### "ZMQ.mqh not found" (25 compile errors)
The EA uses `#include <ZMQ.mqh>` which searches `MQL5/Include/`.
Ensure `ZMQ.mqh` is in the Include folder, not just Experts.

### POSITION_COMMISSION deprecation warning
Already fixed - commission is now tracked via deal history instead.
