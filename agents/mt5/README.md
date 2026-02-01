# Hedge Edge MT5 Expert Advisor

A MetaTrader 5 Expert Advisor that validates Hedge Edge monthly subscription licenses and streams live account data to the Hedge Edge desktop application.

## Components

| File | Description |
|------|-------------|
| `HedgeEdgeLicense.mq5` | MQL5 Expert Advisor source code |
| `HedgeEdgeLicense.ex5` | Compiled EA (generated after compilation) |
| `HedgeEdgeLicense.dll` | Native DLL for HTTPS license validation |
| `HedgeEdgeLicense.h` | DLL header file (for development) |
| `HedgeEdgeLicense.cpp` | DLL source code (for development) |
| `HedgeEdgeLicense.def` | DLL export definitions |

## Features

- **License Validation**: Validates your Hedge Edge subscription on startup and periodically
- **Native DLL**: Uses a native Windows DLL for secure HTTPS communication
- **Token Caching**: Caches authentication tokens with automatic refresh
- **License Gating**: Automatically disables trading when license is invalid/expired
- **Live Data Streaming**: Streams account balance, equity, positions, and performance
- **Remote Commands**: Accepts pause/resume/close-all commands from the Hedge Edge app
- **Network Resilience**: Automatic retry with exponential backoff on network errors

## Installation

### Prerequisites

1. MetaTrader 5 terminal installed
2. Valid Hedge Edge subscription with license key
3. Hedge Edge desktop app installed

### Step 1: Install the DLL

1. **Locate MT5 Libraries folder**:
   - Open MT5
   - Go to **File** → **Open Data Folder**
   - Navigate to `MQL5/Libraries/`

2. **Copy DLL**:
   - Copy `HedgeEdgeLicense.dll` to the `Libraries` folder
   - Full path: `<MT5 Data>/MQL5/Libraries/HedgeEdgeLicense.dll`

### Step 2: Install the EA

1. **Locate MT5 Experts folder**:
   - In the same data folder, navigate to `MQL5/Experts/`

2. **Copy EA files**:
   - Copy `HedgeEdgeLicense.mq5` to the `Experts` folder
   - Or if you have the compiled version, copy `HedgeEdgeLicense.ex5`

3. **Compile (if using .mq5)**:
   - In MT5, open MetaEditor (F4)
   - Open `HedgeEdgeLicense.mq5`
   - Click **Compile** (F7)
   - Verify no errors in the output

### Step 3: Configure MT5 Settings

**CRITICAL: These settings must be enabled for the EA to function!**

1. **Enable Algorithmic Trading**:
   - Go to **Tools** → **Options** → **Expert Advisors**
   - ✅ Check "Allow algorithmic trading"
   - ✅ Check "Allow DLL imports" (Warning: only allow DLLs you trust)

2. **Add WebRequest URL** (if using WebRequest fallback):
   - In the same dialog, add to "Allow WebRequest for listed URL":
   - `https://api.hedge-edge.com`

3. **Enable AutoTrading**:
   - Click the "AutoTrading" button in the toolbar (should be green)

### Step 4: Attach EA to Chart

1. Open a chart (any symbol)
2. In Navigator (Ctrl+N), find "Expert Advisors" → "HedgeEdgeLicense"
3. Drag the EA onto the chart
4. Configure parameters in the dialog:

## Configuration Parameters

### Required

| Parameter | Description |
|-----------|-------------|
| **License Key** | Your Hedge Edge subscription license key |

### Optional - License Settings

| Parameter | Default | Description |
|-----------|---------|-------------|
| **Device ID** | Auto-generated | Unique device identifier |
| **API Endpoint** | `https://api.hedge-edge.com/v1/license/validate` | License API URL |
| **Poll Interval** | 600 | License recheck interval (seconds) |

### Optional - Communication Settings

| Parameter | Default | Description |
|-----------|---------|-------------|
| **Status Channel** | `HedgeEdgeMT5` | Name for data channel (pipe/file) |
| **Data Emit Interval** | 1 | How often to send data (seconds) |
| **Enable Commands** | true | Accept commands from app |

### Optional - Display Settings

| Parameter | Default | Description |
|-----------|---------|-------------|
| **Active Color** | Lime | Color when license active |
| **Paused Color** | Orange | Color when trading paused |
| **Error Color** | Red | Color on errors |
| **Comment Line** | 0 | Vertical position offset |

## Status Channel Format

The EA writes JSON data to a file in MT5's `Files` folder: `MQL5/Files/HedgeEdgeMT5.json`

### Account Snapshot

```json
{
  "timestamp": "2026.01.31 12:00:00",
  "platform": "MT5",
  "accountId": "12345678",
  "broker": "IC Markets",
  "server": "ICMarkets-Demo",
  "balance": 10000.00,
  "equity": 10150.50,
  "margin": 500.00,
  "freeMargin": 9650.50,
  "marginLevel": 2030.10,
  "floatingPnL": 150.50,
  "currency": "USD",
  "leverage": 500,
  "status": "Licensed - Active",
  "isLicenseValid": true,
  "isPaused": false,
  "lastError": null,
  "positions": [
    {
      "id": "123456789",
      "symbol": "EURUSD",
      "volume": 1.00,
      "volumeLots": 1.00,
      "side": "BUY",
      "entryPrice": 1.08500,
      "currentPrice": 1.08650,
      "stopLoss": 1.08000,
      "takeProfit": 1.09000,
      "profit": 150.00,
      "swap": -2.50,
      "commission": -7.00,
      "openTime": "2026.01.31 10:00:00",
      "comment": ""
    }
  ]
}
```

## Command Channel

Commands are sent via file: `MQL5/Files/HedgeEdgeMT5_cmd.json`
Responses are written to: `MQL5/Files/HedgeEdgeMT5_resp.json`

### Available Commands

| Command | Request | Description |
|---------|---------|-------------|
| PAUSE | `{"action":"PAUSE"}` | Pause trading |
| RESUME | `{"action":"RESUME"}` | Resume trading |
| CLOSE_ALL | `{"action":"CLOSE_ALL"}` | Close all positions |
| CLOSE_POSITION | `{"action":"CLOSE_POSITION","positionId":"123"}` | Close specific position |
| STATUS | `{"action":"STATUS"}` | Get current status |

### Example Responses

```json
// Success
{"success":true,"message":"Trading paused"}

// Error
{"success":false,"error":"Cannot resume: license invalid"}

// Close all
{"success":true,"closedCount":3,"errors":[]}
```

## Visual Indicators

The EA displays status on the chart:

| Status | Color | Meaning |
|--------|-------|---------|
| Licensed - Active | 🟢 Green | License valid, trading enabled |
| Licensed - Paused | 🟠 Orange | License valid, trading paused |
| License Invalid | 🔴 Red | License expired or invalid |

## Building the DLL from Source

### Requirements

- Visual Studio 2019 or later
- Windows SDK
- C++17 support

### Build Steps

1. **Create Visual Studio Project**:
   - New Project → Dynamic-Link Library (DLL)
   - Platform: x64
   - Configuration: Release

2. **Add Source Files**:
   - `HedgeEdgeLicense.cpp`
   - `HedgeEdgeLicense.h`
   - `HedgeEdgeLicense.def`

3. **Configure Project**:
   - C/C++ → Preprocessor: Add `HEDGEEDGE_EXPORTS`
   - C/C++ → Code Generation: Runtime Library = `/MT` (Multi-threaded)
   - Linker → Input → Module Definition File: `HedgeEdgeLicense.def`
   - Linker → Input → Additional Dependencies: `winhttp.lib`

4. **Build**:
   - Set to **Release** | **x64**
   - Build → Build Solution
   - Output: `x64/Release/HedgeEdgeLicense.dll`

### Alternative: CMake Build

```cmake
cmake_minimum_required(VERSION 3.15)
project(HedgeEdgeLicense)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded")

add_library(HedgeEdgeLicense SHARED
    HedgeEdgeLicense.cpp
    HedgeEdgeLicense.h
    HedgeEdgeLicense.def
)

target_compile_definitions(HedgeEdgeLicense PRIVATE HEDGEEDGE_EXPORTS)
target_link_libraries(HedgeEdgeLicense winhttp)
```

Build with:
```powershell
mkdir build && cd build
cmake -G "Visual Studio 17 2022" -A x64 ..
cmake --build . --config Release
```

## Troubleshooting

### "DLL import not allowed"
- Enable "Allow DLL imports" in Tools → Options → Expert Advisors
- Restart MT5 after changing this setting

### "License validation failed"
- Verify license key is correct
- Check internet connectivity
- Ensure firewall allows MT5 to make HTTPS connections
- Try adding `https://api.hedge-edge.com` to WebRequest allowed URLs

### EA shows "Initializing..." permanently
- Check Experts tab in Terminal window for error messages
- Ensure DLL is in the correct `Libraries` folder
- Verify DLL is the correct architecture (x64 for MT5 64-bit)

### No data in Hedge Edge app
- Check that the status file exists: `MQL5/Files/HedgeEdgeMT5.json`
- Verify file permissions
- Ensure Data Emit Interval is reasonable (1-5 seconds)

### Commands not working
- Enable "Enable Commands" parameter
- Check command file path: `MQL5/Files/HedgeEdgeMT5_cmd.json`
- Verify JSON format is correct

### DLL not loading
- Ensure you're using x64 DLL with x64 MT5
- Check that Visual C++ Redistributable is installed
- Try running MT5 as Administrator once

## Security Notes

1. **DLL Trust**: Only install DLLs from trusted sources. The DLL has full system access.
2. **License Key**: Keep your license key private. Never share it.
3. **Network**: The DLL uses TLS 1.2+ for all API communications.
4. **Local Files**: Data is written to local files only - no external data transmission except license validation.

## License API

The DLL calls the Hedge Edge license API:

```
POST https://api.hedge-edge.com/v1/license/validate
Content-Type: application/json

{
  "licenseKey": "your-license-key",
  "accountId": "12345678",
  "broker": "IC Markets",
  "deviceId": "generated-device-id",
  "platform": "MT5",
  "version": "1.0.0"
}
```

Expected response:
```json
{
  "valid": true,
  "token": "signed-jwt-token",
  "ttlSeconds": 900,
  "message": "License active",
  "plan": "monthly",
  "expiresAt": "2026-02-28T23:59:59Z"
}
```

## Support

- **License issues**: https://hedge-edge.com/support
- **Technical issues**: support@hedge-edge.com

## Version History

- **1.0.0** (2026-01-31): Initial release
