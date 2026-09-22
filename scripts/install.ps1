<#
.SYNOPSIS
    AIDA64 Web SensorPanel - Turnkey One-Liner Installer for Windows 10/11.
.DESCRIPTION
    Automated turnkey installer for AIDA64 Glassmorphism 2.0 Web SensorPanel.
    Performs prerequisite checks (Python 3.11+ via winget if missing), repository acquisition,
    virtual environment isolation, pip dependencies installation, Windows desktop shortcut creation,
    and live AIDA64 Windows Shared Memory telemetry diagnostic.
.EXAMPLE
    powershell -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/aasanea/aida64-web-sensorpanel/main/scripts/install.ps1 | iex"
#>

[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string]$InstallDir = ""
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Write-Color([string]$text, [ConsoleColor]$color = [ConsoleColor]::White) {
    Write-Host $text -ForegroundColor $color
}

function Write-Banner {
    Clear-Host
    Write-Color "==============================================================================" Cyan
    Write-Color "     ⚡ AIDA64 GLASSMORPHISM 2.0 WEB SENSORPANEL - MASTER INSTALLER          " Yellow
    Write-Color "         0ms ctypes Windows Shared Memory Telemetry HUD for PC Enthusiasts    " Cyan
    Write-Color "==============================================================================" Cyan
    Write-Host ""
}

Write-Banner

if ([string]::IsNullOrWhiteSpace($InstallDir)) {
    $scriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Definition 2>$null }
    if ($scriptRoot -and (Test-Path (Join-Path $scriptRoot "..\backend\requirements.txt"))) {
        $InstallDir = (Resolve-Path (Join-Path $scriptRoot "..")).Path
        Write-Color "[INFO] Detected local repository at: $InstallDir" Gray
    } else {
        $InstallDir = Join-Path $env:USERPROFILE "aida64-web-sensorpanel"
    }
}

Write-Color "[-] Target Installation Directory: $InstallDir" Cyan
Write-Host ""
Write-Color "[1/5] Verifying Python 3.11+ runtime..." Yellow

function Find-PythonExecutable {
    $candidates = @("python.exe", "py.exe")
    foreach ($cmd in $candidates) {
        try {
            $verOutput = & $cmd --version 2>&1
            if ($verOutput -match "Python\s+(\d+)\.(\d+)\.(\d+)") {
                $major = [int]$matches[1]
                $minor = [int]$matches[2]
                if ($major -ge 3 -and $minor -ge 11) {
                    return @{
                        Command = $cmd
                        Version = "$major.$minor.$($matches[3])"
                        Valid = $true
                    }
                }
            }
        } catch {}
    }
    return $null
}

$pyInfo = Find-PythonExecutable

if (-not $pyInfo) {
    Write-Color "[WARNING] Python 3.11+ was not detected in system PATH." Magenta
    Write-Color "Attempting automated installation via Windows Package Manager (winget)..." Gray

    $hasWinget = $false
    try {
        $wingetVer = & winget --version 2>$null
        if ($LASTEXITCODE -eq 0) { $hasWinget = $true }
    } catch {
        $hasWinget = $false
    }

    if ($hasWinget) {
        Write-Color "[INFO] Installing Python 3.12 via winget..." Cyan
        try {
            & winget install -e --id Python.Python.3.12 --scope user --accept-package-agreements --accept-source-agreements --silent
            $regPath = [System.Environment]::GetEnvironmentVariable("Path", "User") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "Machine")
            $env:Path = $regPath
            Start-Sleep -Seconds 2
            $pyInfo = Find-PythonExecutable
        } catch {
            Write-Color "[ERROR] winget installation failed: $_" Red
        }
    }

    if (-not $pyInfo) {
        Write-Color "[ACTION REQUIRED] Python 3.11 or higher is required." Red
        Write-Color "Please download and install Python from:" Yellow
        Write-Color "👉 https://www.python.org/downloads/windows/" Cyan
        Write-Color "(Important: Make sure to check [x] 'Add python.exe to PATH' during setup)" Gray
        Write-Host ""
        $openBrowser = Read-Host "Would you like to open the Python download page now? (Y/n)"
        if ($openBrowser -match "^[yY]?$") {
            Start-Process "https://www.python.org/downloads/windows/"
        }
        Write-Color "Please re-run this installation command after installing Python." Yellow
        exit 1
    }
}

$PY_CMD = $pyInfo.Command
Write-Color "[OK] Detected $($pyInfo.Version) using '$PY_CMD'" Green

Write-Host ""
Write-Color "[2/5] Acquiring repository contents..." Yellow

$repoUrl = "https://github.com/aasanea/aida64-web-sensorpanel.git"
$zipUrl = "https://github.com/aasanea/aida64-web-sensorpanel/archive/refs/heads/main.zip"

if (Test-Path (Join-Path $InstallDir "backend\main.py")) {
    Write-Color "[OK] Existing repository verified at target path." Green
} else {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    
    $gitAvailable = $false
    try {
        & git --version >$null 2>&1
        if ($LASTEXITCODE -eq 0) { $gitAvailable = $true }
    } catch {
        $gitAvailable = $false
    }

    if ($gitAvailable) {
        Write-Color "[INFO] Cloning via Git: $repoUrl..." Cyan
        & git clone --depth 1 $repoUrl $InstallDir
        if ($LASTEXITCODE -ne 0) {
            Write-Color "[ERROR] Git clone failed. Falling back to ZIP archive download..." Magenta
            $gitAvailable = $false
        }
    }

    if (-not $gitAvailable) {
        Write-Color "[INFO] Downloading latest archive from GitHub..." Cyan
        $tempZip = Join-Path $env:TEMP "aida64-web-sensorpanel-main.zip"
        $tempExtract = Join-Path $env:TEMP "aida64_extract_temp_$([System.Guid]::NewGuid().ToString().Substring(0,8))"
        
        try {
            Invoke-WebRequest -Uri $zipUrl -OutFile $tempZip -UseBasicParsing
            Write-Color "[INFO] Extracting release files..." Gray
            Expand-Archive -Path $tempZip -DestinationPath $tempExtract -Force
            
            $subFolder = Get-ChildItem -Path $tempExtract -Directory | Select-Object -First 1
            if ($subFolder) {
                Copy-Item -Path "$($subFolder.FullName)\*" -Destination $InstallDir -Recurse -Force
            }
            Remove-Item -Path $tempExtract -Recurse -Force -ErrorAction SilentlyContinue
            Remove-Item -Path $tempZip -Force -ErrorAction SilentlyContinue
            Write-Color "[OK] Archive extracted successfully." Green
        } catch {
            Write-Color "[ERROR] Failed to download or extract repository archive: $_" Red
            exit 1
        }
    }
}

Write-Host ""
Write-Color "[3/5] Setting up isolated Python Virtual Environment (.venv)..." Yellow

$venvDir = Join-Path $InstallDir ".venv"
$venvPython = Join-Path $venvDir "Scripts\python.exe"
$venvPip = Join-Path $venvDir "Scripts\pip.exe"

if (-not (Test-Path $venvPython)) {
    Write-Color "[INFO] Creating virtual environment at: $venvDir" Cyan
    & $PY_CMD -m venv $venvDir
    if ($LASTEXITCODE -ne 0) {
        Write-Color "[ERROR] Failed to create virtual environment." Red
        exit 1
    }
} else {
    Write-Color "[OK] Existing virtual environment found." Green
}

$reqPath = Join-Path $InstallDir "backend\requirements.txt"
if (Test-Path $reqPath) {
    Write-Color "[INFO] Installing backend dependencies from requirements.txt..." Cyan
    & $venvPython -m pip install --upgrade pip --quiet
    & $venvPip install -r $reqPath --quiet
    if ($LASTEXITCODE -eq 0) {
        Write-Color "[OK] Dependencies successfully installed." Green
    } else {
        Write-Color "[WARNING] Pip encountered errors during quiet install. Trying standard install..." Magenta
        & $venvPip install -r $reqPath
    }
} else {
    Write-Color "[WARNING] requirements.txt not found. Installing core packages..." Magenta
    & $venvPip install fastapi uvicorn websockets pydantic loguru hijri-converter
}

Write-Host ""
Write-Color "[4/5] Creating Windows Desktop Shortcut..." Yellow

try {
    $wshShell = New-Object -ComObject WScript.Shell
    $desktopPath = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Desktop)
    $shortcutPath = Join-Path $desktopPath "AIDA64 Web SensorPanel.lnk"
    $nativeExe = Join-Path $InstallDir "bin\AIDA64Panel.exe"
    $nativeIcon = Join-Path $InstallDir "bin\icon.ico"
    $targetBatch = Join-Path $InstallDir "scripts\start.bat"

    $shortcut = $wshShell.CreateShortcut($shortcutPath)
    if (Test-Path $nativeExe) {
        $shortcut.TargetPath = $nativeExe
        $shortcut.WorkingDirectory = (Join-Path $InstallDir "bin")
        if (Test-Path $nativeIcon) {
            $shortcut.IconLocation = "$nativeIcon,0"
        }
    } else {
        $shortcut.TargetPath = $targetBatch
        $shortcut.WorkingDirectory = $InstallDir
        $edgeApp = Join-Path ${env:ProgramFiles(x86)} "Microsoft\Edge\Application\msedge.exe"
        if (-not (Test-Path $edgeApp)) {
            $edgeApp = Join-Path $env:ProgramFiles "Microsoft\Edge\Application\msedge.exe"
        }
        if (Test-Path $edgeApp) {
            $shortcut.IconLocation = "$edgeApp,0"
        }
    }
    $shortcut.Description = "AIDA64 Glassmorphism 2.0 Web SensorPanel HUD"
    $shortcut.Save()

    Write-Color "[OK] Created Desktop shortcut: 'AIDA64 Web SensorPanel'" Green
} catch {
    Write-Color "[WARNING] Could not create desktop shortcut: $_" Gray
}

Write-Host ""
Write-Color "[5/5] Testing real-time connection to AIDA64 Shared Memory..." Yellow

$diagScript = @"
import sys
from pathlib import Path
sys.path.insert(0, str(Path(r'$InstallDir') / 'backend'))
try:
    from services.aida_service import read_shared_memory, get_sensors_and_count
    raw = read_shared_memory()
    if raw:
        metrics, count = get_sensors_and_count(fallback_registry=False)
        print(f"STATUS_OK:{count}")
    else:
        print("STATUS_NO_SHM")
except Exception as e:
    print(f"STATUS_ERR:{e}")
"@

$diagResult = & $venvPython -c $diagScript 2>$null

if ($diagResult -match "STATUS_OK:(\d+)") {
    $sensorCount = $matches[1]
    Write-Color "==============================================================================" Green
    Write-Color "  ✨ [SUCCESS] AIDA64 SHARED MEMORY BRIDGE IS ONLINE & READY!                " Green
    Write-Color "  ⚡ Verified $sensorCount active hardware sensors streaming in RAM.           " Green
    Write-Color "==============================================================================" Green
} else {
    Write-Color "------------------------------------------------------------------------------" Yellow
    Write-Color "  ⚠️  AIDA64 SHARED MEMORY NOT CURRENTLY DETECTED IN RAM                      " Yellow
    Write-Color "------------------------------------------------------------------------------" Yellow
    Write-Color "The dashboard is installed and ready, but AIDA64 must export its memory buffer:" Gray
    Write-Host ""
    Write-Color "  1. Open AIDA64 Extreme on this computer." White
    Write-Color "  2. Go to: File -> Preferences (ملف -> تفضيلات)" White
    Write-Color "  3. Select: Hardware Monitoring -> External Applications (مراقبة العتاد)" White
    Write-Color "  4. Enable: [x] Enable shared memory (تفعيل الذاكرة المشتركة)" Cyan
    Write-Color "  5. Enable: [x] Enable writing sensor values to Registry (اختياري / احتياطي)" Cyan
    Write-Color "  6. Click Apply & OK." White
    Write-Host ""
}

Write-Color "==============================================================================" Cyan
Write-Color "  Installation successfully completed!                                       " Green
Write-Color "  Installed Path  : $InstallDir" Gray
Write-Color "  Desktop Shortcut: Desktop\AIDA64 Web SensorPanel.lnk" Gray
Write-Color "  Start Script    : $InstallDir\scripts\start.bat" Gray
Write-Color "==============================================================================" Cyan
Write-Host ""

$launch = Read-Host "Would you like to launch AIDA64 Web SensorPanel right now? (Y/n)"
if ($launch -match "^[yY]?$") {
    Write-Color "Launching AIDA64 Web SensorPanel..." Cyan
    Start-Process (Join-Path $InstallDir "scripts\start.bat")
}
