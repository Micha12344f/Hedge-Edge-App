# Hedge Edge MT5 EA Installation Guide

Complete guide for installing and configuring the Hedge Edge License Expert Advisor in MetaTrader 5.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Installation](#quick-installation)
3. [Manual Installation](#manual-installation)
4. [MT5 Configuration](#mt5-configuration)
5. [EA Configuration](#ea-configuration)
6. [Verification](#verification)
7. [Troubleshooting](#troubleshooting)
8. [FAQ](#faq)

---

## Prerequisites

Before installing the Hedge Edge EA, ensure you have:

- ✅ **MetaTrader 5** - Download from your broker or [MetaQuotes](https://www.metatrader5.com/en/download)
- ✅ **Hedge Edge License Key** - Obtain from [hedge-edge.com](https://hedge-edge.com)
- ✅ **Hedge Edge Desktop App** - For data visualization and remote control
- ✅ **Internet Connection** - Required for license validation

### System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| Windows | Windows 10 | Windows 10/11 |
| MT5 Version | Build 3000+ | Latest |
| RAM | 4 GB | 8 GB |
| Network | Broadband | Low latency |

---

## Quick Installation

For most users, the automated deployment script is the fastest method.

### Step 1: Download Files

Download the Hedge Edge MT5 package containing:
- `HedgeEdgeLicense.dll` - Native validation library
- `HedgeEdgeLicense.mq5` - EA source code
- `deploy_to_mt5.ps1` - Deployment script

### Step 2: Run Deployment Script

1. Open **PowerShell** as Administrator
2. Navigate to the download folder:
   ```powershell
   cd "C:\path\to\hedge-edge-mt5"
   ```
3. Run the deployment script:
   ```powershell
   .\deploy_to_mt5.ps1
   ```

The script will:
- Automatically detect all MT5 terminals
- Copy files to the correct locations
- Display post-installation instructions

### Step 3: Compile and Configure

1. Open MetaTrader 5
2. Press **F4** to open MetaEditor
3. Open `HedgeEdgeLicense.mq5` from Experts folder
4. Press **F7** to compile
5. Continue to [MT5 Configuration](#mt5-configuration)

---

## Manual Installation

If the automated script doesn't work, follow these manual steps.

### Step 1: Locate MT5 Data Folder

1. Open MetaTrader 5
2. Go to **File** → **Open Data Folder**
3. Note the path (usually `%APPDATA%\MetaQuotes\Terminal\<TERMINAL_ID>`)

### Step 2: Copy DLL

Copy `HedgeEdgeLicense.dll` to:
```
<MT5 Data Folder>\MQL5\Libraries\HedgeEdgeLicense.dll
```

### Step 3: Copy EA Source

Copy `HedgeEdgeLicense.mq5` to:
```
<MT5 Data Folder>\MQL5\Experts\HedgeEdgeLicense.mq5
```

### Step 4: Compile EA

1. Open MetaTrader 5
2. Press **F4** to open MetaEditor
3. In Navigator, expand **Experts**
4. Double-click `HedgeEdgeLicense.mq5`
5. Press **F7** to compile
6. Check the output window for errors (should show "0 errors, 0 warnings")

---

## MT5 Configuration

**⚠️ CRITICAL: These settings must be configured for the EA to function!**

### Enable Algorithmic Trading

1. Go to **Tools** → **Options** → **Expert Advisors** tab
2. Enable the following settings:

| Setting | Status | Purpose |
|---------|--------|---------|
| ☑️ Allow automated trading | Required | Enables EA operation |
| ☑️ Allow DLL imports | **Required** | Enables license DLL |
| ☑️ Allow WebRequest for listed URL | Recommended | Backup validation method |

### Add WebRequest URLs

In the same dialog, add these URLs to the WebRequest list:

```
https://api.hedge-edge.com
```

For development/testing, also add:
```
http://localhost:8080
```

![MT5 Options](https://hedge-edge.com/docs/img/mt5-options.png)

### Click OK to save settings

**Important:** Restart MT5 after changing these settings.

---

## EA Configuration

### Attaching the EA to a Chart

1. Open any chart (the symbol doesn't matter for license management)
2. In the **Navigator** panel (Ctrl+N), find:
   - Expert Advisors → HedgeEdgeLicense
3. Drag and drop the EA onto the chart
4. The EA configuration dialog will appear

### Required Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| **License Key** | Your Hedge Edge subscription key | `HE-XXXX-XXXX-XXXX-XXXX` |

### Optional Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| Device ID | Auto-generated | Links license to this device |
| API Endpoint | `https://api.hedge-edge.com/v1/license/validate` | License server URL |
| Poll Interval | 600 seconds | How often to recheck license |
| Status Channel | `HedgeEdgeMT5` | Name for data communication |
| Data Emit Interval | 1 second | How often to send data |
| Enable Commands | true | Accept remote commands |
| Active Color | Lime | Chart label color when active |
| Paused Color | Orange | Chart label color when paused |
| Error Color | Red | Chart label color on errors |

### Final Steps

1. Enter your **License Key** (required)
2. Click **OK**
3. The EA will validate your license
4. Enable **AutoTrading** (button in toolbar should be green)

---

## Verification

### Successful Installation

When correctly installed and configured, you should see:

1. **Chart Display**: Green label showing `"Hedge Edge: Licensed - Active"`
2. **Experts Tab**: No error messages
3. **Journal Tab**: Log messages confirming license validation

### Expected Log Messages

```
Hedge Edge License EA initializing...
HedgeEdgeLicense.dll loaded successfully
License validated successfully. TTL: 900 seconds
Hedge Edge License EA initialized successfully
```

### Verify Data Streaming

1. Open the Hedge Edge desktop app
2. Navigate to the Accounts section
3. Your MT5 account should appear with live data

---

## Troubleshooting

### Common Issues and Solutions

#### "DLL import not allowed"

**Cause:** DLL imports are disabled in MT5 settings.

**Solution:**
1. Go to Tools → Options → Expert Advisors
2. Enable "Allow DLL imports"
3. Restart MT5

#### "License validation failed"

**Possible Causes:**
- Invalid or expired license key
- Network connectivity issues
- Firewall blocking HTTPS connections

**Solutions:**
1. Verify your license key is correct
2. Check internet connectivity
3. Add firewall exception for MT5
4. Try adding `https://api.hedge-edge.com` to WebRequest URLs

#### EA shows "Initializing..." permanently

**Possible Causes:**
- DLL not found
- DLL architecture mismatch

**Solutions:**
1. Verify DLL is in `MQL5\Libraries\` folder
2. Ensure you're using the x64 DLL with 64-bit MT5
3. Check Experts tab for specific error messages

#### "Cannot load library"

**Possible Causes:**
- Missing Visual C++ Runtime
- DLL dependencies missing

**Solutions:**
1. Install [Visual C++ Redistributable 2019+](https://aka.ms/vs/17/release/vc_redist.x64.exe)
2. Run MT5 as Administrator once

#### No data in Hedge Edge app

**Possible Causes:**
- Data file not being written
- App not reading correct file path

**Solutions:**
1. Check that `MQL5\Files\HedgeEdgeMT5.json` exists and updates
2. Verify the Status Channel parameter matches app settings
3. Increase Data Emit Interval if network is slow

#### Commands not working

**Possible Causes:**
- Commands disabled in EA settings
- File permission issues

**Solutions:**
1. Enable "Enable Commands" in EA parameters
2. Verify `MQL5\Files\` folder is writable
3. Check for `HedgeEdgeMT5_cmd.json` file

---

## FAQ

### Q: Can I use the EA on multiple accounts?

**A:** Yes, but each account requires a separate license or a multi-account license plan. Each MT5 terminal can run one instance of the EA.

### Q: Does the EA work with demo accounts?

**A:** Yes, the EA works with both demo and live accounts. Some license plans may restrict to demo-only or live-only usage.

### Q: What happens if my internet connection drops?

**A:** The EA caches the license token locally. It will continue operating for the duration of the token TTL (typically 15 minutes). When the connection is restored, it will automatically revalidate.

### Q: Is my trading data sent to external servers?

**A:** Only license validation data is sent to Hedge Edge servers. Your account data is written locally to a JSON file that the desktop app reads. No trading data leaves your machine.

### Q: Can I use multiple EAs with Hedge Edge?

**A:** Yes, you can run other EAs alongside HedgeEdgeLicense. The license EA only handles subscription validation and data streaming—it does not place trades or interfere with other EAs.

### Q: How do I update the EA?

**A:** 
1. Download the new version
2. Replace files in the same locations
3. Recompile in MetaEditor (F7)
4. Restart MT5 to load new DLL

### Q: Why does the EA need DLL imports?

**A:** The native DLL provides secure HTTPS communication for license validation. MQL5's built-in WebRequest has limitations that the DLL overcomes, including better TLS support and retry logic.

---

## Support

- **Documentation**: https://docs.hedge-edge.com
- **Support Portal**: https://hedge-edge.com/support
- **Email**: support@hedge-edge.com

---

*Last updated: February 2026 | Version 1.0.0*
