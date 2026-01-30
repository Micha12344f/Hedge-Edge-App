# ============================================================
# Install MT5 Server as Windows Service
# ============================================================
# Run this AFTER setup_vps.ps1 and copying server files
# ============================================================

$serviceName = "MT5APIServer"
$projectDir = "C:\MT5Server"
$pythonExe = "$projectDir\venv\Scripts\python.exe"
$serverScript = "$projectDir\mt5_vps_server.py"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Installing MT5 API Server as Windows Service" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Check if files exist
if (-not (Test-Path $serverScript)) {
    Write-Host "ERROR: mt5_vps_server.py not found in $projectDir" -ForegroundColor Red
    Write-Host "Please copy the server file first!" -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Path "$projectDir\.env")) {
    Write-Host "ERROR: .env file not found in $projectDir" -ForegroundColor Red
    Write-Host "Please create the .env file with your API key!" -ForegroundColor Yellow
    exit 1
}

# Stop and remove existing service if present
$existingService = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
if ($existingService) {
    Write-Host "Stopping existing service..." -ForegroundColor Yellow
    nssm stop $serviceName
    nssm remove $serviceName confirm
}

# Install new service
Write-Host "Installing service..." -ForegroundColor Yellow
nssm install $serviceName $pythonExe $serverScript
nssm set $serviceName AppDirectory $projectDir
nssm set $serviceName DisplayName "MT5 API Server"
nssm set $serviceName Description "Flask API server for MetaTrader 5 integration"
nssm set $serviceName Start SERVICE_AUTO_START
nssm set $serviceName AppStdout "$projectDir\logs\stdout.log"
nssm set $serviceName AppStderr "$projectDir\logs\stderr.log"

# Create logs directory
if (-not (Test-Path "$projectDir\logs")) {
    New-Item -ItemType Directory -Path "$projectDir\logs" -Force | Out-Null
}

# Start the service
Write-Host "Starting service..." -ForegroundColor Yellow
nssm start $serviceName

# Check status
Start-Sleep -Seconds 3
$service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
if ($service.Status -eq "Running") {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host "  Service installed and running!" -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "API Server: http://localhost:5000" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Service commands:" -ForegroundColor Yellow
    Write-Host "  Stop:    nssm stop $serviceName" -ForegroundColor White
    Write-Host "  Start:   nssm start $serviceName" -ForegroundColor White
    Write-Host "  Restart: nssm restart $serviceName" -ForegroundColor White
    Write-Host "  Status:  Get-Service $serviceName" -ForegroundColor White
    Write-Host "  Logs:    Get-Content $projectDir\logs\stdout.log -Tail 50" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "WARNING: Service may not have started correctly" -ForegroundColor Yellow
    Write-Host "Check logs: $projectDir\logs\stderr.log" -ForegroundColor Yellow
    Write-Host ""
}
