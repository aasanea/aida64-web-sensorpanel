<#
.SYNOPSIS
    AIDA64 Glassmorphism Dashboard - Enterprise Live Auto-Update Script.
.DESCRIPTION
    Passive staging handoff updater:
    1. Detects environment: Git repository vs. Standalone release archive.
    2. Git Mode: runs 'git pull --rebase', updates dependencies, restarts server.
    3. Standalone Mode:
       - Backs up data (appointments.json, .env).
       - Queries and downloads latest GitHub release asset.
       - Terminates running backend processes on port 8088.
       - Stages and extracts updated files.
       - Restores protected user data and configuration.
       - Re-verifies backend dependencies.
       - Restarts server with automated /health verification.
       - Automatic rollback if update or startup fails.
#>

[CmdletBinding()]
param (
    [Parameter(Mandatory=$false)]
    [string]$Repo = "aasanea/aida64-web-sensorpanel",

    [Parameter(Mandatory=$false)]
    [int]$Port = 8088,

    [Parameter(Mandatory=$false)]
    [int]$HealthTimeoutSeconds = 30,

    [Parameter(Mandatory=$false)]
    [switch]$Force,

    [Parameter(Mandatory=$false)]
    [switch]$NoRestart
)

$ErrorActionPreference = "Stop"

# Define Project Paths
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir   = Split-Path -Parent $ScriptDir
$BackendDir = Join-Path $RootDir "backend"
$DataDir    = Join-Path $BackendDir "data"
$ReqFile    = Join-Path $BackendDir "requirements.txt"
$StartBat   = Join-Path $ScriptDir "start.bat"

# Identify Python Command
$PythonCmd = "python"
try {
    & $PythonCmd --version *>$null
} catch {
    $PythonCmd = "py"
}

Write-Host ""
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "         AIDA64 DASHBOARD - LIVE AUTO-UPDATE PIPELINE" -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "[INFO] Project Root: $RootDir" -ForegroundColor Gray
Write-Host "[INFO] Target Repository: $Repo" -ForegroundColor Gray
Write-Host ""

# Helper: Check Server Health
function Test-ServerHealth {
    param ([int]$Timeout = 5)
    $url = "http://localhost:$Port/health"
    try {
        $resp = Invoke-RestMethod -Uri $url -Method Get -TimeoutSec $Timeout -ErrorAction Stop
        if ($resp.status -eq "healthy") {
            return $true
        }
    } catch {
        return $false
    }
    return $false
}

# Helper: Terminate Backend Processes Listening on Port
function Stop-BackendProcess {
    Write-Host "[INFO] Checking for active server process on port $Port..." -ForegroundColor Yellow
    try {
        $connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Where-Object { $_.State -eq 'Listen' }
        if ($connections) {
            foreach ($conn in $connections) {
                $pidToKill = $conn.OwningProcess
                if ($pidToKill -gt 0) {
                    Write-Host "[INFO] Terminating listening process (PID: $pidToKill)..." -ForegroundColor Yellow
                    Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue
                }
            }
            Start-Sleep -Seconds 2
        }
    } catch {
        Write-Warning "Port inspection note: $_"
    }

    # Also search for orphaned uvicorn main:app processes
    try {
        $uvicornProcs = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*uvicorn*main:app*" -or $_.CommandLine -like "*uvicorn*main:app*" }
        foreach ($proc in $uvicornProcs) {
            Write-Host "[INFO] Terminating uvicorn worker process (PID: $($proc.ProcessId))..." -ForegroundColor Yellow
            Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
        }
    } catch {}
}

# Helper: Restart Backend Server
function Start-BackendServer {
    if ($NoRestart) {
        Write-Host "[INFO] -NoRestart switch specified. Skipping startup." -ForegroundColor Yellow
        return $true
    }

    Write-Host "[INFO] Launching background backend server via $StartBat..." -ForegroundColor Cyan
    if (Test-Path $StartBat) {
        Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "`"$StartBat`"" -WorkingDirectory $RootDir -WindowStyle Hidden
    } else {
        Start-Process -FilePath $PythonCmd -ArgumentList "-m uvicorn main:app --host 0.0.0.0 --port $Port" -WorkingDirectory $BackendDir -WindowStyle Hidden
    }

    Write-Host "[INFO] Awaiting /health verification (timeout: ${HealthTimeoutSeconds}s)..." -ForegroundColor Gray
    $elapsed = 0
    while ($elapsed -lt $HealthTimeoutSeconds) {
        Start-Sleep -Seconds 1
        $elapsed++
        if (Test-ServerHealth -Timeout 2) {
            Write-Host "[OK] Backend server is online, healthy, and serving port $Port!" -ForegroundColor Green
            return $true
        }
    }
    Write-Host "[ERROR] Timed out waiting for backend server to report healthy." -ForegroundColor Red
    return $false
}

# Check Git vs. Standalone
$GitDir = Join-Path $RootDir ".git"
$IsGitRepo = Test-Path $GitDir

if ($IsGitRepo) {
    Write-Host "[MODE] Git Repository detected (.git exists)." -ForegroundColor Green
    Write-Host "[STEP 1/4] Creating safety backup of user appointments and config..." -ForegroundColor Cyan
    
    $BackupDir = Join-Path $RootDir "backups\git_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
    
    $ApptSrc = Join-Path $DataDir "appointments.json"
    if (Test-Path $ApptSrc) {
        Copy-Item -Path $ApptSrc -Destination (Join-Path $BackupDir "appointments.json") -Force
        Write-Host "  - Backed up appointments.json" -ForegroundColor Gray
    }
    $EnvSrc = Join-Path $BackendDir ".env"
    if (Test-Path $EnvSrc) {
        Copy-Item -Path $EnvSrc -Destination (Join-Path $BackupDir ".env") -Force
        Write-Host "  - Backed up backend\.env" -ForegroundColor Gray
    }

    Write-Host "[STEP 2/4] Executing 'git pull --rebase'..." -ForegroundColor Cyan
    try {
        Push-Location $RootDir
        $gitOutput = & git pull --rebase 2>&1
        Write-Host $gitOutput -ForegroundColor Gray
        Pop-Location
    } catch {
        Write-Host "[ERROR] Git pull failed: $_" -ForegroundColor Red
        exit 1
    }

    Write-Host "[STEP 3/4] Updating Python dependencies..." -ForegroundColor Cyan
    if (Test-Path $ReqFile) {
        & $PythonCmd -m pip install -r $ReqFile --quiet
        Write-Host "[OK] Dependencies updated." -ForegroundColor Green
    }

    Write-Host "[STEP 4/4] Performing graceful server restart..." -ForegroundColor Cyan
    Stop-BackendProcess
    $started = Start-BackendServer
    if (-not $started) {
        Write-Host "[WARNING] Health check did not respond in time. Please check logs/backend.log." -ForegroundColor Yellow
        exit 1
    }

    Write-Host ""
    Write-Host "==============================================================================" -ForegroundColor Green
    Write-Host "      SUCCESS: AIDA64 DASHBOARD UPDATED AND RUNNING SUCCESSFULLY!            " -ForegroundColor Green
    Write-Host "==============================================================================" -ForegroundColor Green
    exit 0
}

# Standalone ZIP Distribution Mode
Write-Host "[MODE] Standalone Distribution detected (No .git folder)." -ForegroundColor Cyan
$BackupDir = Join-Path $RootDir "backups\pre_update_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
$StagingTempDir = Join-Path ([System.IO.Path]::GetTempPath()) "aida64_update_$(Get-Random)"

try {
    Write-Host "[STEP 1/6] Creating verified snapshot backup of user appointments and config..." -ForegroundColor Cyan
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
    
    $ApptSrc = Join-Path $DataDir "appointments.json"
    $hasAppointments = Test-Path $ApptSrc
    if ($hasAppointments) {
        Copy-Item -Path $ApptSrc -Destination (Join-Path $BackupDir "appointments.json") -Force
        Write-Host "  - Preserved appointments.json" -ForegroundColor Gray
    }
    
    # Backup all json files in data
    if (Test-Path $DataDir) {
        Get-ChildItem -Path $DataDir -Filter "*.json" | ForEach-Object {
            Copy-Item -Path $_.FullName -Destination $BackupDir -Force
        }
    }

    $BackendEnvSrc = Join-Path $BackendDir ".env"
    $hasBackendEnv = Test-Path $BackendEnvSrc
    if ($hasBackendEnv) {
        Copy-Item -Path $BackendEnvSrc -Destination (Join-Path $BackupDir "backend.env") -Force
        Write-Host "  - Preserved backend\.env" -ForegroundColor Gray
    }

    $RootEnvSrc = Join-Path $RootDir ".env"
    $hasRootEnv = Test-Path $RootEnvSrc
    if ($hasRootEnv) {
        Copy-Item -Path $RootEnvSrc -Destination (Join-Path $BackupDir "root.env") -Force
        Write-Host "  - Preserved root .env" -ForegroundColor Gray
    }

    Write-Host "[STEP 2/6] Querying latest release from GitHub ($Repo)..." -ForegroundColor Cyan
    $headers = @{
        "User-Agent" = "aida64-dashboard-updater/1.0.0"
        "Accept"     = "application/vnd.github.v3+json"
    }
    $releaseUrl = "https://api.github.com/repos/$Repo/releases/latest"
    $release = Invoke-RestMethod -Uri $releaseUrl -Headers $headers -Method Get -TimeoutSec 15
    
    $tagName = $release.tag_name
    Write-Host "  - Latest Release Tag: $tagName ($($release.name))" -ForegroundColor Green

    # Locate download asset or fallback to zipball
    $downloadUrl = $null
    if ($release.assets -and $release.assets.Count -gt 0) {
        $zipAsset = $release.assets | Where-Object { $_.name -like "*.zip" } | Select-Object -First 1
        if ($zipAsset) {
            $downloadUrl = $zipAsset.browser_download_url
            Write-Host "  - Found Release Asset: $($zipAsset.name)" -ForegroundColor Gray
        }
    }
    if (-not $downloadUrl) {
        $downloadUrl = $release.zipball_url
        Write-Host "  - Using GitHub source archive zipball." -ForegroundColor Gray
    }

    if (-not $downloadUrl) {
        throw "Could not determine a download URL for release $tagName."
    }

    Write-Host "[STEP 3/6] Downloading release package..." -ForegroundColor Cyan
    New-Item -ItemType Directory -Path $StagingTempDir -Force | Out-Null
    $zipFile = Join-Path $StagingTempDir "release.zip"
    Invoke-WebRequest -Uri $downloadUrl -OutFile $zipFile -Headers $headers -TimeoutSec 60
    Write-Host "  - Downloaded ($((Get-Item $zipFile).Length / 1KB -as [int]) KB)" -ForegroundColor Green

    Write-Host "[STEP 4/6] Extracting staged files..." -ForegroundColor Cyan
    $extractDir = Join-Path $StagingTempDir "extracted"
    Expand-Archive -Path $zipFile -DestinationPath $extractDir -Force

    # If GitHub zipball wrapped root directory, locate the nested inner root
    $sourceRoot = $extractDir
    if (-not (Test-Path (Join-Path $extractDir "backend"))) {
        $nestedDir = Get-ChildItem -Path $extractDir -Directory | Where-Object { Test-Path (Join-Path $_.FullName "backend") } | Select-Object -First 1
        if ($nestedDir) {
            $sourceRoot = $nestedDir.FullName
        }
    }

    Write-Host "[STEP 5/6] Applying files and restoring configuration..." -ForegroundColor Cyan
    # Stop backend before copying over files
    Stop-BackendProcess

    # Copy files from sourceRoot to RootDir (exclude backups or .git)
    Get-ChildItem -Path $sourceRoot | Where-Object { $_.Name -notin @(".git", "backups") } | ForEach-Object {
        Copy-Item -Path $_.FullName -Destination $RootDir -Recurse -Force
    }

    # Restore preserved user files
    if ($hasAppointments -and (Test-Path (Join-Path $BackupDir "appointments.json"))) {
        if (-not (Test-Path $DataDir)) { New-Item -ItemType Directory -Path $DataDir -Force | Out-Null }
        Copy-Item -Path (Join-Path $BackupDir "appointments.json") -Destination $ApptSrc -Force
        Write-Host "  - Restored appointments.json" -ForegroundColor Green
    }
    if ($hasBackendEnv -and (Test-Path (Join-Path $BackupDir "backend.env"))) {
        Copy-Item -Path (Join-Path $BackupDir "backend.env") -Destination $BackendEnvSrc -Force
        Write-Host "  - Restored backend\.env" -ForegroundColor Green
    }
    if ($hasRootEnv -and (Test-Path (Join-Path $BackupDir "root.env"))) {
        Copy-Item -Path (Join-Path $BackupDir "root.env") -Destination $RootEnvSrc -Force
        Write-Host "  - Restored root .env" -ForegroundColor Green
    }

    # Re-install dependencies if changed
    if (Test-Path $ReqFile) {
        Write-Host "  - Verifying Python dependencies..." -ForegroundColor Gray
        & $PythonCmd -m pip install -r $ReqFile --quiet
    }

    Write-Host "[STEP 6/6] Verifying system health and restarting..." -ForegroundColor Cyan
    $started = Start-BackendServer

    if (-not $started) {
        throw "Backend server failed health check on port $Port after update."
    }

    Write-Host ""
    Write-Host "==============================================================================" -ForegroundColor Green
    Write-Host "      SUCCESS: STANDALONE DASHBOARD UPDATED TO $tagName AND HEALTHY!          " -ForegroundColor Green
    Write-Host "==============================================================================" -ForegroundColor Green
    exit 0

} catch {
    Write-Host ""
    Write-Host "==============================================================================" -ForegroundColor Red
    Write-Host "                     UPDATE FAILED - INITIATING ROLLBACK                     " -ForegroundColor Red
    Write-Host "==============================================================================" -ForegroundColor Red
    Write-Host "Error Details: $_" -ForegroundColor Yellow

    # Rollback execution
    Write-Host "[ROLLBACK] Restoring appointments and configuration from $BackupDir..." -ForegroundColor Magenta
    try {
        Stop-BackendProcess

        if (Test-Path (Join-Path $BackupDir "appointments.json")) {
            if (-not (Test-Path $DataDir)) { New-Item -ItemType Directory -Path $DataDir -Force | Out-Null }
            Copy-Item -Path (Join-Path $BackupDir "appointments.json") -Destination $ApptSrc -Force
            Write-Host "  - Restored original appointments.json" -ForegroundColor Gray
        }
        if (Test-Path (Join-Path $BackupDir "backend.env")) {
            Copy-Item -Path (Join-Path $BackupDir "backend.env") -Destination $BackendEnvSrc -Force
            Write-Host "  - Restored original backend\.env" -ForegroundColor Gray
        }
        if (Test-Path (Join-Path $BackupDir "root.env")) {
            Copy-Item -Path (Join-Path $BackupDir "root.env") -Destination $RootEnvSrc -Force
            Write-Host "  - Restored original root .env" -ForegroundColor Gray
        }

        # Attempt to restart server on original files
        Start-BackendServer | Out-Null
        Write-Host "[ROLLBACK COMPLETE] Restored previous configuration safely." -ForegroundColor Green
    } catch {
        Write-Host "[ROLLBACK ERROR] Error during rollback: $_" -ForegroundColor Red
    }

    exit 1
} finally {
    # Cleanup staging directory
    if ($StagingTempDir -and (Test-Path $StagingTempDir)) {
        Remove-Item -Path $StagingTempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}
