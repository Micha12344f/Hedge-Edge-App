# ============================================================================
# Hedge Edge MT5 Deployment Script
# ============================================================================
# This script deploys the HedgeEdgeLicense EA and DLL to MT5 terminals
# 
# Usage:
#   .\deploy_to_mt5.ps1              # Deploy to all detected terminals
#   .\deploy_to_mt5.ps1 -List        # List detected terminals only
#   .\deploy_to_mt5.ps1 -Terminal ID # Deploy to specific terminal
#   .\deploy_to_mt5.ps1 -CustomPath "path" # Deploy to custom MT5 data path
# ============================================================================

param(
    [switch]$List,
    [string]$Terminal,
    [string]$CustomPath,
    [switch]$Verify,
    [switch]$Help
)

# Configuration
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$DllName = "HedgeEdgeLicense.dll"
$MQ5Name = "HedgeEdgeLicense.mq5"
$RequiredFiles = @(
    "HedgeEdgeLicense.dll",
    "HedgeEdgeLicense.mq5",
    "HedgeEdgeLicense.h",     # Optional, for development
    "ZMQ.mqh",                # Optional, for ZMQ version
    "Sodium.mqh"              # Optional, for encryption
)

# ============================================================================
# Functions
# ============================================================================

function Write-Banner {
    param([string]$Message)
    $line = "=" * 60
    Write-Host ""
    Write-Host $line -ForegroundColor Cyan
    Write-Host "  $Message" -ForegroundColor White
    Write-Host $line -ForegroundColor Cyan
    Write-Host ""
}

function Write-Step {
    param([string]$Message)
    Write-Host "[*] $Message" -ForegroundColor Green
}

function Write-ErrorMsg {
    param([string]$Message)
    Write-Host "[!] ERROR: $Message" -ForegroundColor Red
}

function Write-WarningMsg {
    param([string]$Message)
    Write-Host "[!] WARNING: $Message" -ForegroundColor Yellow
}

function Write-Info {
    param([string]$Message)
    Write-Host "    $Message" -ForegroundColor Gray
}

function Show-Help {
    Write-Host @"
Hedge Edge MT5 Deployment Script

USAGE:
    .\deploy_to_mt5.ps1 [OPTIONS]

OPTIONS:
    -List           List all detected MT5 terminals without deploying
    -Terminal ID    Deploy to a specific terminal (use terminal hash ID)
    -CustomPath     Deploy to a custom MT5 data folder path
    -Verify         Verify existing deployment without modifying
    -Help           Show this help message

EXAMPLES:
    .\deploy_to_mt5.ps1                              # Deploy to all terminals
    .\deploy_to_mt5.ps1 -List                        # List terminals only
    .\deploy_to_mt5.ps1 -Terminal A1B2C3D4          # Deploy to specific terminal
    .\deploy_to_mt5.ps1 -CustomPath "D:\MT5\Data"   # Deploy to custom path
    .\deploy_to_mt5.ps1 -Verify                     # Check deployment status

FILES DEPLOYED:
    - HedgeEdgeLicense.dll  -> MQL5\Libraries\
    - HedgeEdgeLicense.mq5  -> MQL5\Experts\

PREREQUISITES:
    - MetaTrader 5 installed and run at least once
    - HedgeEdgeLicense.dll compiled (run build_dll.ps1 first)

"@
}

function Find-MT5Terminals {
    $terminals = @()
    
    # Primary location: AppData\Roaming\MetaQuotes\Terminal
    $mt5DataPath = Join-Path $env:APPDATA "MetaQuotes\Terminal"
    
    if (Test-Path $mt5DataPath) {
        $terminalDirs = Get-ChildItem -Path $mt5DataPath -Directory | Where-Object {
            # Terminal folders are 32-character hex strings
            $_.Name -match "^[A-F0-9]{32}$"
        }
        
        foreach ($dir in $terminalDirs) {
            $mql5Path = Join-Path $dir.FullName "MQL5"
            $librariesPath = Join-Path $mql5Path "Libraries"
            $expertsPath = Join-Path $mql5Path "Experts"
            $includesPath = Join-Path $mql5Path "Include"
            $filesPath = Join-Path $mql5Path "Files"
            
            # Try to identify the terminal
            $terminalInfo = @{
                Id = $dir.Name
                ShortId = $dir.Name.Substring(0, 8)
                FullPath = $dir.FullName
                MQL5Path = $mql5Path
                LibrariesPath = $librariesPath
                ExpertsPath = $expertsPath
                IncludesPath = $includesPath
                FilesPath = $filesPath
                Exists = Test-Path $mql5Path
                BrokerName = "Unknown"
                LastModified = $dir.LastWriteTime
            }
            
            # Try to identify broker from origin.txt if exists
            $originFile = Join-Path $dir.FullName "origin.txt"
            if (Test-Path $originFile) {
                $origin = Get-Content $originFile -Raw -ErrorAction SilentlyContinue
                if ($origin) {
                    $terminalInfo.BrokerName = $origin.Trim()
                }
            }
            
            # Check for common broker configuration files
            $configFiles = Get-ChildItem -Path $dir.FullName -Filter "*.srv" -ErrorAction SilentlyContinue
            if ($configFiles.Count -gt 0) {
                $terminalInfo.BrokerName = $configFiles[0].BaseName
            }
            
            $terminals += [PSCustomObject]$terminalInfo
        }
    }
    
    # Also check Program Files for portable installations
    $portablePaths = @(
        "C:\Program Files\MetaTrader 5",
        "C:\Program Files (x86)\MetaTrader 5",
        "D:\MetaTrader 5",
        "D:\MT5"
    )
    
    foreach ($path in $portablePaths) {
        if (Test-Path $path) {
            $mql5Path = Join-Path $path "MQL5"
            if (Test-Path $mql5Path) {
                $terminals += [PSCustomObject]@{
                    Id = "PORTABLE_" + [System.IO.Path]::GetFileName($path).Replace(" ", "_")
                    ShortId = "PORTABLE"
                    FullPath = $path
                    MQL5Path = $mql5Path
                    LibrariesPath = Join-Path $mql5Path "Libraries"
                    ExpertsPath = Join-Path $mql5Path "Experts"
                    IncludesPath = Join-Path $mql5Path "Include"
                    FilesPath = Join-Path $mql5Path "Files"
                    Exists = $true
                    BrokerName = "Portable Installation"
                    LastModified = (Get-Item $path).LastWriteTime
                }
            }
        }
    }
    
    return $terminals
}

function Show-TerminalList {
    param([array]$Terminals)
    
    Write-Banner "Detected MT5 Terminals"
    
    if ($Terminals.Count -eq 0) {
        Write-WarningMsg "No MT5 terminals found"
        Write-Info "MT5 data is typically located at: $env:APPDATA\MetaQuotes\Terminal\"
        Write-Info "Make sure MetaTrader 5 has been run at least once."
        return
    }
    
    Write-Host ("{0,-10} {1,-25} {2,-20}" -f "ID", "Broker/Name", "Last Modified") -ForegroundColor White
    Write-Host ("-" * 60) -ForegroundColor Gray
    
    foreach ($terminal in $Terminals) {
        $status = if ($terminal.Exists) { "[OK]" } else { "[!]" }
        $statusColor = if ($terminal.Exists) { "Green" } else { "Yellow" }
        
        Write-Host ("{0,-10} " -f $terminal.ShortId) -NoNewline -ForegroundColor $statusColor
        Write-Host ("{0,-25} " -f $terminal.BrokerName.Substring(0, [Math]::Min(24, $terminal.BrokerName.Length))) -NoNewline
        Write-Host ("{0,-20}" -f $terminal.LastModified.ToString("yyyy-MM-dd HH:mm"))
    }
    
    Write-Host ""
}

function Verify-Deployment {
    param([PSCustomObject]$Terminal)
    
    $status = @{
        Terminal = $Terminal.ShortId
        DllInstalled = $false
        MQ5Installed = $false
        EX5Compiled = $false
        Issues = @()
    }
    
    # Check DLL
    $dllPath = Join-Path $Terminal.LibrariesPath $DllName
    if (Test-Path $dllPath) {
        $status.DllInstalled = $true
        $dllInfo = Get-Item $dllPath
        $status.DllSize = $dllInfo.Length
        $status.DllDate = $dllInfo.LastWriteTime
    }
    else {
        $status.Issues += "DLL not found in Libraries folder"
    }
    
    # Check MQ5
    $mq5Path = Join-Path $Terminal.ExpertsPath $MQ5Name
    if (Test-Path $mq5Path) {
        $status.MQ5Installed = $true
        $mq5Info = Get-Item $mq5Path
        $status.MQ5Date = $mq5Info.LastWriteTime
    }
    else {
        $status.Issues += "MQ5 source not found in Experts folder"
    }
    
    # Check compiled EX5
    $ex5Name = $MQ5Name -replace "\.mq5$", ".ex5"
    $ex5Path = Join-Path $Terminal.ExpertsPath $ex5Name
    if (Test-Path $ex5Path) {
        $status.EX5Compiled = $true
        $ex5Info = Get-Item $ex5Path
        $status.EX5Date = $ex5Info.LastWriteTime
    }
    else {
        $status.Issues += "EA not compiled (no .ex5 file) - compile in MetaEditor"
    }
    
    return $status
}

function Deploy-Files {
    param(
        [PSCustomObject]$Terminal,
        [switch]$Force
    )
    
    $success = $true
    $deployed = @()
    $skipped = @()
    $errors = @()
    
    # Ensure directories exist
    $directories = @($Terminal.LibrariesPath, $Terminal.ExpertsPath, $Terminal.IncludesPath)
    foreach ($dir in $directories) {
        if (-not (Test-Path $dir)) {
            try {
                New-Item -ItemType Directory -Path $dir -Force | Out-Null
                Write-Info "Created: $dir"
            }
            catch {
                Write-WarningMsg "Could not create directory: $dir"
            }
        }
    }
    
    # Deploy DLL to Libraries
    $sourceDll = Join-Path $ScriptDir $DllName
    if (Test-Path $sourceDll) {
        $destDll = Join-Path $Terminal.LibrariesPath $DllName
        try {
            Copy-Item -Path $sourceDll -Destination $destDll -Force
            $deployed += "Libraries\$DllName"
        }
        catch {
            $errors += "Failed to copy DLL: $_"
            $success = $false
        }
    }
    else {
        $skipped += $DllName
        Write-WarningMsg "DLL not found. Run build_dll.ps1 first."
    }
    
    # Deploy MQ5 to Experts
    $sourceMq5 = Join-Path $ScriptDir $MQ5Name
    if (Test-Path $sourceMq5) {
        $destMq5 = Join-Path $Terminal.ExpertsPath $MQ5Name
        try {
            Copy-Item -Path $sourceMq5 -Destination $destMq5 -Force
            $deployed += "Experts\$MQ5Name"
        }
        catch {
            $errors += "Failed to copy MQ5: $_"
            $success = $false
        }
    }
    else {
        $skipped += $MQ5Name
    }
    
    # Deploy optional include files
    $optionalIncludes = @("ZMQ.mqh", "Sodium.mqh")
    foreach ($file in $optionalIncludes) {
        $sourceFile = Join-Path $ScriptDir $file
        if (Test-Path $sourceFile) {
            $destFile = Join-Path $Terminal.IncludesPath $file
            try {
                Copy-Item -Path $sourceFile -Destination $destFile -Force
                $deployed += "Include\$file"
            }
            catch {
                $errors += "Failed to copy $file`: $_"
            }
        }
    }
    
    return @{
        Success = $success
        Deployed = $deployed
        Skipped = $skipped
        Errors = $errors
    }
}

function Show-PostDeploymentInstructions {
    Write-Host ""
    Write-Host "=" * 60 -ForegroundColor Cyan
    Write-Host "  POST-DEPLOYMENT STEPS" -ForegroundColor White
    Write-Host "=" * 60 -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1. COMPILE THE EA IN METAEDITOR:" -ForegroundColor Yellow
    Write-Host "   - Open MetaTrader 5"
    Write-Host "   - Press F4 to open MetaEditor"
    Write-Host "   - Open File > Open and navigate to Experts folder"
    Write-Host "   - Open HedgeEdgeLicense.mq5"
    Write-Host "   - Press F7 to compile"
    Write-Host "   - Verify no errors in the output window"
    Write-Host ""
    Write-Host "2. CONFIGURE MT5 SETTINGS:" -ForegroundColor Yellow
    Write-Host "   Go to Tools > Options > Expert Advisors"
    Write-Host "   - [x] Allow algorithmic trading"
    Write-Host "   - [x] Allow DLL imports"
    Write-Host "   - Add to WebRequest URLs: https://api.hedge-edge.com"
    Write-Host ""
    Write-Host "3. ATTACH EA TO CHART:" -ForegroundColor Yellow
    Write-Host "   - Open any chart (e.g., EURUSD)"
    Write-Host "   - In Navigator (Ctrl+N), find Expert Advisors > HedgeEdgeLicense"
    Write-Host "   - Drag onto chart"
    Write-Host "   - Enter your License Key in the parameters"
    Write-Host "   - Click OK"
    Write-Host ""
    Write-Host "4. VERIFY:" -ForegroundColor Yellow
    Write-Host "   - AutoTrading button should be green"
    Write-Host "   - EA should show 'Licensed - Active' on chart"
    Write-Host "   - Check Experts tab for any error messages"
    Write-Host ""
}

# ============================================================================
# Main
# ============================================================================

if ($Help) {
    Show-Help
    exit 0
}

Write-Host ""
Write-Host "  Hedge Edge MT5 Deployment Tool" -ForegroundColor Cyan
Write-Host "  Version 1.0.0" -ForegroundColor Gray
Write-Host ""

# Find all terminals
$terminals = Find-MT5Terminals

# List mode
if ($List) {
    Show-TerminalList $terminals
    exit 0
}

# Custom path mode
if ($CustomPath) {
    if (-not (Test-Path $CustomPath)) {
        Write-ErrorMsg "Custom path does not exist: $CustomPath"
        exit 1
    }
    
    $customTerminal = [PSCustomObject]@{
        Id = "CUSTOM"
        ShortId = "CUSTOM"
        FullPath = $CustomPath
        MQL5Path = Join-Path $CustomPath "MQL5"
        LibrariesPath = Join-Path $CustomPath "MQL5\Libraries"
        ExpertsPath = Join-Path $CustomPath "MQL5\Experts"
        IncludesPath = Join-Path $CustomPath "MQL5\Include"
        FilesPath = Join-Path $CustomPath "MQL5\Files"
        Exists = Test-Path (Join-Path $CustomPath "MQL5")
        BrokerName = "Custom Path"
        LastModified = (Get-Item $CustomPath).LastWriteTime
    }
    
    $terminals = @($customTerminal)
}

# Specific terminal mode
if ($Terminal) {
    $matchedTerminal = $terminals | Where-Object { 
        $_.Id -like "$Terminal*" -or $_.ShortId -eq $Terminal 
    }
    
    if (-not $matchedTerminal) {
        Write-ErrorMsg "Terminal not found: $Terminal"
        Show-TerminalList $terminals
        exit 1
    }
    
    $terminals = @($matchedTerminal)
}

# Verify mode
if ($Verify) {
    Write-Banner "Verifying Deployment Status"
    
    foreach ($terminal in $terminals) {
        Write-Step "Terminal: $($terminal.ShortId) ($($terminal.BrokerName))"
        
        $status = Verify-Deployment -Terminal $terminal
        
        $dllStatus = if ($status.DllInstalled) { "[OK]" } else { "[MISSING]" }
        $mq5Status = if ($status.MQ5Installed) { "[OK]" } else { "[MISSING]" }
        $ex5Status = if ($status.EX5Compiled) { "[OK]" } else { "[NOT COMPILED]" }
        
        Write-Info "DLL:      $dllStatus"
        Write-Info "MQ5:      $mq5Status"
        Write-Info "EX5:      $ex5Status"
        
        if ($status.Issues.Count -gt 0) {
            Write-Host ""
            Write-WarningMsg "Issues:"
            foreach ($issue in $status.Issues) {
                Write-Host "    - $issue" -ForegroundColor Yellow
            }
        }
        Write-Host ""
    }
    exit 0
}

# Deploy mode
if ($terminals.Count -eq 0) {
    Write-ErrorMsg "No MT5 terminals found"
    Write-Info "Make sure MetaTrader 5 is installed and has been run at least once."
    exit 1
}

Write-Banner "Deploying to MT5 Terminals"

$totalDeployed = 0
$totalErrors = 0

foreach ($terminal in $terminals) {
    Write-Step "Deploying to: $($terminal.ShortId) ($($terminal.BrokerName))"
    Write-Info "Path: $($terminal.FullPath)"
    
    $result = Deploy-Files -Terminal $terminal
    
    if ($result.Deployed.Count -gt 0) {
        foreach ($file in $result.Deployed) {
            Write-Host "    [+] $file" -ForegroundColor Green
        }
        $totalDeployed++
    }
    
    if ($result.Skipped.Count -gt 0) {
        foreach ($file in $result.Skipped) {
            Write-Host "    [-] $file (not found)" -ForegroundColor Yellow
        }
    }
    
    if ($result.Errors.Count -gt 0) {
        foreach ($error in $result.Errors) {
            Write-Host "    [!] $error" -ForegroundColor Red
        }
        $totalErrors++
    }
    
    Write-Host ""
}

Write-Host "Deployment Summary:" -ForegroundColor White
Write-Host "  Terminals: $totalDeployed deployed, $totalErrors with errors" -ForegroundColor $(if ($totalErrors -gt 0) { "Yellow" } else { "Green" })

Show-PostDeploymentInstructions
