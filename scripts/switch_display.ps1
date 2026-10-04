# ==============================================================================
# AIDA64 SensorPanel - Display Switcher & Health Orchestrator
# Target: 'primary' (0, 0) or 'dedicated' (3840, -1200)
# ==============================================================================
param(
    [ValidateSet('primary', 'dedicated')]
    [string]$Target = 'primary'
)

$ErrorActionPreference = 'SilentlyContinue'

$scriptDir = $PSScriptRoot
$rootDir = Split-Path -Parent $scriptDir
$backendDir = Join-Path $rootDir "backend"
$binExe = Join-Path $rootDir "bin\AIDA64Panel.exe"
$healthUrl = "http://localhost:8088/health"

# 1. Verify Backend Health
$backendHealthy = $false
try {
    $res = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 1 -ErrorAction Stop
    if ($res.status -eq 'healthy') {
        $backendHealthy = $true
    }
} catch {
    $backendHealthy = $false
}

if (-not $backendHealthy) {
    Write-Host "[INFO] Backend not responding. Starting background backend..." -ForegroundColor Yellow
    $pythonExe = "pythonw"
    if (-not (Get-Command pythonw -ErrorAction SilentlyContinue)) {
        $pythonExe = "python"
    }
    Start-Process $pythonExe -ArgumentList "main.py" -WorkingDirectory $backendDir -WindowStyle Hidden
    
    # Wait up to 10 seconds for backend to become healthy
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    while ($sw.ElapsedMilliseconds -lt 10000) {
        Start-Sleep -Milliseconds 400
        try {
            $check = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 1 -ErrorAction Stop
            if ($check.status -eq 'healthy') {
                $backendHealthy = $true
                break
            }
        } catch { }
    }
}

# 2. Identify Target Display Coordinates
Add-Type -AssemblyName System.Windows.Forms
$screens = [System.Windows.Forms.Screen]::AllScreens

$targetX = 0
$targetY = 0
$targetW = 1920
$targetH = 1080

if ($Target -eq 'primary') {
    $primary = [System.Windows.Forms.Screen]::PrimaryScreen
    if ($primary) {
        $targetX = $primary.Bounds.X
        $targetY = $primary.Bounds.Y
        $targetW = $primary.Bounds.Width
        $targetH = $primary.Bounds.Height
    }
} else {
    $dedicated = $screens | Where-Object { $_.Bounds.X -ge 3840 -and $_.Bounds.Y -lt 0 } | Select-Object -First 1
    if ($dedicated) {
        $targetX = $dedicated.Bounds.X
        $targetY = $dedicated.Bounds.Y
        $targetW = $dedicated.Bounds.Width
        $targetH = $dedicated.Bounds.Height
    } else {
        $targetX = 3840
        $targetY = -1200
        $targetW = 1920
        $targetH = 1200
    }
}

# 3. Check if AIDA64Panel is running
$panelProc = Get-Process -Name "AIDA64Panel" -ErrorAction SilentlyContinue | Select-Object -First 1
$eventName = if ($Target -eq 'primary') { "AIDA64_SensorPanel_Primary_Signal" } else { "AIDA64_SensorPanel_Dedicated_Signal" }

if (-not $panelProc) {
    Write-Host "[INFO] AIDA64Panel not currently running. Launching with target: $Target" -ForegroundColor Cyan
    Start-Process -FilePath $binExe -ArgumentList "--$Target" -WorkingDirectory (Split-Path -Parent $binExe)
    Start-Sleep -Milliseconds 1200
} else {
    Write-Host "[INFO] AIDA64Panel running (PID $($panelProc.Id)). Signaling target display: $Target" -ForegroundColor Cyan
    
    # Direct IPC EventWaitHandle trigger
    try {
        $handle = $null
        if ([System.Threading.EventWaitHandle]::TryOpenExisting($eventName, [ref]$handle)) {
            $handle.Set()
            $handle.Dispose()
            Write-Host "[OK] Direct IPC event '$eventName' triggered successfully." -ForegroundColor Green
        }
    } catch { }

    # Secondary launcher execution as seamless backup
    Start-Process -FilePath $binExe -ArgumentList "--$Target" -WorkingDirectory (Split-Path -Parent $binExe) -WindowStyle Hidden
}

# 4. Fail-safe Win32 Relocation Guard (Direct OS-level window placement)
$win32Snippet = @"
using System;
using System.Runtime.InteropServices;

public class Win32DisplayGuard {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    public static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);
    public const uint SWP_SHOWWINDOW = 0x0040;
    public const int SW_RESTORE = 9;

    public static bool MoveWindowDirect(string windowTitle, int x, int y, int w, int h) {
        IntPtr hWnd = FindWindow(null, windowTitle);
        if (hWnd == IntPtr.Zero) return false;
        ShowWindow(hWnd, SW_RESTORE);
        SetWindowPos(hWnd, HWND_TOPMOST, x, y, w, h, SWP_SHOWWINDOW);
        SetForegroundWindow(hWnd);
        return true;
    }
}
"@

if (-not ([System.Management.Automation.PSTypeName]'Win32DisplayGuard').Type) {
    Add-Type -TypeDefinition $win32Snippet -ErrorAction SilentlyContinue
}

try {
    Start-Sleep -Milliseconds 300
    $moved = [Win32DisplayGuard]::MoveWindowDirect("AIDA64 SensorPanel Host", $targetX, $targetY, $targetW, $targetH)
    if ($moved) {
        Write-Host "[SUCCESS] AIDA64 SensorPanel window placed at ($targetX, $targetY) Size: ${targetW}x${targetH}" -ForegroundColor Green
    }
} catch { }

Write-Host "[DONE] Display switch to $Target completed." -ForegroundColor Green
exit 0
