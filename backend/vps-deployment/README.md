# MT5 VPS Deployment Package
## For Hostinger KVM 2 (8GB RAM, 2 vCPU, 100GB SSD)

This folder contains everything you need to deploy your MT5 API server to your Hostinger VPS.

---

## 📦 Package Contents

| File | Purpose |
|------|---------|
| `setup_vps.ps1` | Automated setup script (run first) |
| `install_service.ps1` | Installs server as Windows Service |
| `mt5_vps_server.py` | The Flask API server |
| `.env.example` | Environment configuration template |

---

## 🚀 Quick Deployment Guide

### Step 1: Purchase Hostinger KVM 2
- Go to hostinger.com → VPS → KVM 2
- Select **Windows Server 2022**
- Choose datacenter closest to your users
- Complete purchase

### Step 2: Connect to VPS
1. Get your VPS IP and credentials from Hostinger panel
2. On your PC: Press `Win + R`, type `mstsc`, Enter
3. Enter VPS IP, login with Administrator credentials

### Step 3: Transfer Files
Copy this entire `vps-deployment` folder to your VPS:
- Option A: Use Windows Remote Desktop file sharing
- Option B: Upload to Google Drive/Dropbox, download on VPS
- Option C: Use `scp` if you have SSH enabled

### Step 4: Run Setup
1. Open PowerShell **as Administrator** on the VPS
2. Navigate to the deployment folder
3. Run:
```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force
.\setup_vps.ps1
```

### Step 5: Install MetaTrader 5
1. Download: https://www.metatrader5.com/en/download
2. Install to default location
3. **IMPORTANT**: Open MT5 and login to ANY account once (this initializes the terminal)
4. Keep MT5 running (minimize, don't close)

### Step 6: Configure Environment
1. Copy `.env.example` to `.env`
2. Generate a secure API key at https://randomkeygen.com/
3. Update the `.env` file:
```
MT5_API_KEY=your-64-character-secure-key-here
```

### Step 7: Install as Service
```powershell
.\install_service.ps1
```

### Step 8: Test the API
Open browser on VPS: http://localhost:5000/api/health

Should return:
```json
{"status": "healthy", "mt5_connected": true, ...}
```

### Step 9: Update Your Web App
In your React project's `.env`:
```
VITE_MT5_VPS_URL=http://YOUR_VPS_IP:5000
VITE_MT5_API_KEY=your-64-character-secure-key-here
```

---

## 🔒 Security Recommendations

1. **Change the default API key immediately**
2. **Consider adding a domain + Cloudflare** for free HTTPS
3. **Enable Windows Firewall** (the script opens only port 5000)
4. **Set up regular backups** in Hostinger panel
5. **Keep Windows updated** via Windows Update

---

## 🛠 Troubleshooting

### Server won't start
- Check if MT5 is running
- View logs: `Get-Content C:\MT5Server\logs\stderr.log -Tail 50`

### Can't connect from web app
- Check firewall: `Get-NetFirewallRule -DisplayName "MT5 API Server"`
- Test locally first: `curl http://localhost:5000/api/health`

### MT5 login fails
- Ensure MT5 terminal has been opened and logged in manually at least once
- Check if the broker server name is correct

---

## 📞 Support

If you need help, check:
1. Server logs: `C:\MT5Server\logs\`
2. Windows Event Viewer for service issues
3. Hostinger support for VPS issues
