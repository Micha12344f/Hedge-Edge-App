# ============================================================
# MT5 VPS Server - Automated Setup Script for Hostinger KVM 2
# ============================================================
# Run this script as Administrator on your Windows VPS
# ============================================================

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  MT5 VPS Server - Automated Setup" -ForegroundColor Cyan
Write-Host "  Hostinger KVM 2 (8GB RAM, 2 vCPU)" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: Please run this script as Administrator!" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    exit 1
}

# Create project directory
Write-Host "[1/7] Creating project directory..." -ForegroundColor Yellow
$projectDir = "C:\MT5Server"
if (-not (Test-Path $projectDir)) {
    New-Item -ItemType Directory -Path $projectDir -Force | Out-Null
}
Set-Location $projectDir

# Install Chocolatey if not present
Write-Host "[2/7] Installing Chocolatey package manager..." -ForegroundColor Yellow
if (-not (Get-Command choco -ErrorAction SilentlyContinue)) {
    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
    refreshenv
}

# Install Python 3.11
Write-Host "[3/7] Installing Python 3.11..." -ForegroundColor Yellow
choco install python311 -y
refreshenv

# Install NSSM for Windows Service
Write-Host "[4/7] Installing NSSM (Windows Service Manager)..." -ForegroundColor Yellow
choco install nssm -y

# Create virtual environment
Write-Host "[5/7] Creating Python virtual environment..." -ForegroundColor Yellow
python -m venv venv
& ".\venv\Scripts\Activate.ps1"

# Install Python dependencies
Write-Host "[6/7] Installing Python dependencies..." -ForegroundColor Yellow
pip install --upgrade pip
pip install MetaTrader5 Flask Flask-CORS python-dotenv waitress

# Configure firewall
Write-Host "[7/7] Configuring Windows Firewall..." -ForegroundColor Yellow
$ruleName = "MT5 API Server"
$existingRule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if (-not $existingRule) {
    New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Port 5000 -Protocol TCP -Action Allow
    Write-Host "  Firewall rule created for port 5000" -ForegroundColor Green
} else {
    Write-Host "  Firewall rule already exists" -ForegroundColor Green
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  Setup Complete!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Download and install MT5 from https://www.metatrader5.com/en/download" -ForegroundColor White
Write-Host "  2. Login to MT5 at least once to initialize it" -ForegroundColor White
Write-Host "  3. Copy mt5_vps_server.py to C:\MT5Server\" -ForegroundColor White
Write-Host "  4. Edit C:\MT5Server\.env with your secure API key" -ForegroundColor White
Write-Host "  5. Run: C:\MT5Server\install_service.ps1" -ForegroundColor White
Write-Host ""
Write-Host "Your VPS IP: " -NoNewline -ForegroundColor Cyan
(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notlike "*Loopback*" }).IPAddress | ForEach-Object { Write-Host $_ -ForegroundColor White }
Write-Host ""
