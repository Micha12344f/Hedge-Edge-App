# launch_app.ps1
# ==============
# Starts the Hedge-Edge-App Vite dev server for screenshot capture.
# Copies the seeder HTML into the public folder so it's served at /seed-demo-data.html

$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path "$PSScriptRoot\..\..\..\.."
$FrontendDir = Join-Path $ProjectRoot "Hedge-Edge-App\Hedge-Edge-Front-end"
$TmpDir = Join-Path $ProjectRoot "tmp"
$SeederFile = Join-Path $TmpDir "seed-demo-data.html"
$PublicDir = Join-Path $FrontendDir "public"

Write-Host "=== Hedge Edge Demo Launcher ===" -ForegroundColor Green

# Step 1: Generate seed HTML if not present
$SeedScript = Join-Path $PSScriptRoot "seed_localStorage.js"
if (Test-Path $SeedScript) {
    Write-Host "`n[1/3] Generating seeder HTML..." -ForegroundColor Cyan
    Push-Location $PSScriptRoot
    node $SeedScript
    Pop-Location
}

# Step 2: Copy seeder to public/ so Vite serves it
if (Test-Path $SeederFile) {
    Copy-Item $SeederFile -Destination $PublicDir -Force
    Write-Host "[2/3] Seeder copied to $PublicDir" -ForegroundColor Cyan
} else {
    Write-Host "[2/3] WARNING: $SeederFile not found — skipping copy" -ForegroundColor Yellow
}

# Step 3: Start Vite dev server
Write-Host "[3/3] Starting Vite dev server..." -ForegroundColor Cyan
Write-Host ""
Write-Host "  Once started, open: http://localhost:5173/seed-demo-data.html" -ForegroundColor Yellow
Write-Host "  Click 'Seed Demo Data' → app loads with demo accounts" -ForegroundColor Yellow
Write-Host ""

Set-Location $FrontendDir
npm run dev
