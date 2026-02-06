# MT5 ZeroMQ Library Dependencies

This folder should contain the pre-built ZeroMQ and libsodium DLLs required for the ZeroMQ-based MT5 Expert Advisor (`HedgeEdgeZMQ.mq5`).

## Required Files

| File | Description | Architecture |
|------|-------------|--------------|
| `libzmq.dll` | ZeroMQ messaging library | x64 |
| `libsodium.dll` | Cryptographic library | x64 |

## Download Sources

### Option 1: Official Releases (Recommended)

1. **ZeroMQ (libzmq)**
   - Download from: https://github.com/zeromq/libzmq/releases
   - Get the Windows x64 build (e.g., `libzmq-v4.3.5-windows-x64.zip`)
   - Extract `libzmq.dll` to this folder

2. **libsodium**
   - Download from: https://download.libsodium.org/libsodium/releases/
   - Get the MSVC build (e.g., `libsodium-1.0.19-msvc.zip`)
   - Extract `libsodium.dll` from `x64/Release/` to this folder

### Option 2: vcpkg

```powershell
vcpkg install zeromq:x64-windows
vcpkg install libsodium:x64-windows
```

Then copy the DLLs from `vcpkg/installed/x64-windows/bin/`.

## Installation

After downloading, copy both DLLs to:
- This folder (`agents/mt5/lib/`)
- AND to your MT5 terminal: `<MT5 Data>/MQL5/Libraries/`

## Verification

The DLLs should be x64 (64-bit) to match MetaTrader 5's architecture:

```powershell
# Check if DLL is 64-bit
dumpbin /headers libzmq.dll | findstr "machine"
# Should show: 8664 machine (x64)
```

## Version Compatibility

| Component | Tested Version |
|-----------|---------------|
| ZeroMQ | 4.3.4+ |
| libsodium | 1.0.18+ |
| MetaTrader 5 | Build 3500+ |
