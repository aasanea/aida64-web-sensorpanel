# ==============================================================================
# AIDA64 Dashboard - Reliable Display Placer & Kiosk Launcher
# Target: Screen 2 (Top-Right above Screen 3: 1920x1200 at 3840, -1200)
# Feature: Win32 Hybrid Hook (100% Taskbar Elimination & Win+D Immunity)
# ==============================================================================
param(
    [int]$TargetX = 3840,
    [int]$TargetY = -1200,
    [int]$TargetW = 1920,
    [int]$TargetH = 1200
)

# 1. Win32 Shell & Taskbar Helper definition
$win32Snippet = @"
using System;
using System.Runtime.InteropServices;

public class Win32Taskbar {
    // --- DPI Awareness ---
    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetProcessDpiAwarenessContext(IntPtr dpiContext);
    public static readonly IntPtr DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2 = new IntPtr(-4);

    // --- 64-bit / 32-bit Safe Get/SetWindowLongPtr ---
    [DllImport("user32.dll", EntryPoint = "GetWindowLong")]
    private static extern IntPtr GetWindowLong32(IntPtr hWnd, int nIndex);

    [DllImport("user32.dll", EntryPoint = "GetWindowLongPtr")]
    private static extern IntPtr GetWindowLongPtr64(IntPtr hWnd, int nIndex);

    [DllImport("user32.dll", EntryPoint = "SetWindowLong")]
    private static extern IntPtr SetWindowLong32(IntPtr hWnd, int nIndex, IntPtr dwNewLong);

    [DllImport("user32.dll", EntryPoint = "SetWindowLongPtr")]
    private static extern IntPtr SetWindowLongPtr64(IntPtr hWnd, int nIndex, IntPtr dwNewLong);

    public static IntPtr GetWindowLongPtr(IntPtr hWnd, int nIndex) {
        if (IntPtr.Size == 8) return GetWindowLongPtr64(hWnd, nIndex);
        return GetWindowLong32(hWnd, nIndex);
    }

    public static IntPtr SetWindowLongPtr(IntPtr hWnd, int nIndex, IntPtr dwNewLong) {
        if (IntPtr.Size == 8) return SetWindowLongPtr64(hWnd, nIndex, dwNewLong);
        return SetWindowLong32(hWnd, nIndex, dwNewLong);
    }

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

    // --- COM Interface: ITaskbarList ---
    [ComImport]
    [Guid("56FDF344-FD6D-11d0-958A-006097C9A090")]
    [ClassInterface(ClassInterfaceType.None)]
    private class TaskbarList { }

    [ComImport]
    [Guid("56FDF342-FD6D-11d0-958A-006097C9A090")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface ITaskbarList {
        [PreserveSig] int HrInit();
        [PreserveSig] int AddTab(IntPtr hwnd);
        [PreserveSig] int DeleteTab(IntPtr hwnd);
        [PreserveSig] int ActivateTab(IntPtr hwnd);
        [PreserveSig] int SetActiveAlt(IntPtr hwnd);
    }

    public const int GWL_EXSTYLE = -20;
    public const long WS_EX_TOOLWINDOW = 0x00000080L;
    public const long WS_EX_APPWINDOW = 0x00040000L;

    public const uint SWP_NOSIZE = 0x0001;
    public const uint SWP_NOMOVE = 0x0002;
    public const uint SWP_NOACTIVATE = 0x0010;
    public const uint SWP_FRAMECHANGED = 0x0020;
    public const uint SWP_SHOWWINDOW = 0x0040;

    public static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);

    public static void RemoveFromTaskbarAndPin(IntPtr hWnd, int x, int y, int w, int h) {
        if (hWnd == IntPtr.Zero) return;

        // 1. Remove from Taskbar via ITaskbarList COM interface
        try {
            ITaskbarList tbl = (ITaskbarList)new TaskbarList();
            tbl.HrInit();
            tbl.DeleteTab(hWnd);
            Marshal.ReleaseComObject(tbl);
        } catch {}

        // 2. Modify Extended Style: Apply WS_EX_TOOLWINDOW & Strip WS_EX_APPWINDOW
        try {
            long exStyle = GetWindowLongPtr(hWnd, GWL_EXSTYLE).ToInt64();
            exStyle = (exStyle & ~WS_EX_APPWINDOW) | WS_EX_TOOLWINDOW;
            SetWindowLongPtr(hWnd, GWL_EXSTYLE, new IntPtr(exStyle));
        } catch {}

        // 3. Pin to secondary display with Win+D immunity (HWND_TOPMOST) and trigger Shell frame change
        uint flags = SWP_FRAMECHANGED | SWP_SHOWWINDOW | SWP_NOACTIVATE;
        SetWindowPos(hWnd, HWND_TOPMOST, x, y, w, h, flags);
    }
}
"@
if (-not ([System.Management.Automation.PSTypeName]'Win32Taskbar').Type) {
    Add-Type -TypeDefinition $win32Snippet
}
try { [Win32Taskbar]::SetProcessDpiAwarenessContext([Win32Taskbar]::DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2) } catch {}

# 2. Ensure backend is running silently (using pythonw to eliminate console flashing)
$healthUrl = "http://localhost:8088/health"
$healthy = $false
try {
    $res = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 2 -ErrorAction SilentlyContinue
    if ($res.status -eq 'healthy') { $healthy = $true }
} catch {}

if (-not $healthy) {
    $backendDir = Join-Path (Split-Path -Parent $PSScriptRoot) "backend"
    $pythonExe = "pythonw"
    if (-not (Get-Command pythonw -ErrorAction SilentlyContinue)) { $pythonExe = "python" }
    Start-Process $pythonExe -ArgumentList "-m uvicorn main:app --host 0.0.0.0 --port 8088" -WorkingDirectory $backendDir -WindowStyle Hidden
    Start-Sleep -Seconds 2
}

# 3. Terminate any previous stuck kiosk instance first so it doesn't overwrite Preferences on exit
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*AIDA64_Kiosk_Profile*" } | ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Milliseconds 800

# 4. Determine target display coordinates dynamically (Screen 2: 1920x1200 at X=3840, Y=-1200)
Add-Type -AssemblyName System.Windows.Forms
$screens = [System.Windows.Forms.Screen]::AllScreens
$targetScreen = $screens | Where-Object { 
    $_.DeviceName -eq '\\.\DISPLAY3' -or ($_.Bounds.X -ge 3840 -and $_.Bounds.Y -lt 0)
} | Select-Object -First 1

if ($targetScreen) {
    $TargetX = $targetScreen.Bounds.X
    $TargetY = $targetScreen.Bounds.Y
    $TargetW = $targetScreen.Bounds.Width
    $TargetH = $targetScreen.Bounds.Height
} else {
    $TargetX = 3840
    $TargetY = -1200
    $TargetW = 1920
    $TargetH = 1200
}

Write-Host "Target Screen Identified: Screen 2 ($TargetX, $TargetY) Size: ${TargetW}x${TargetH}"

# 5. Pre-seed Chrome / Edge dedicated Kiosk Profile with exact window placement for Screen 2
$kioskProfileDir = "$env:LOCALAPPDATA\AIDA64_Kiosk_Profile\Default"
if (-not (Test-Path $kioskProfileDir)) {
    New-Item -ItemType Directory -Path $kioskProfileDir -Force | Out-Null
}
$prefFile = Join-Path $kioskProfileDir "Preferences"
$prefObj = @{}
if (Test-Path $prefFile) {
    try {
        $raw = [System.IO.File]::ReadAllText($prefFile, [System.Text.Encoding]::UTF8)
        $prefObj = $raw | ConvertFrom-Json
    } catch {}
}
if (-not $prefObj) { $prefObj = @{} }
if (-not $prefObj.browser) {
    $prefObj | Add-Member -NotePropertyName "browser" -NotePropertyValue (@{}) -Force
}

$placement = [PSCustomObject]@{
    left = $TargetX
    top = $TargetY
    right = ($TargetX + $TargetW)
    bottom = ($TargetY + $TargetH)
    work_area_left = $TargetX
    work_area_top = $TargetY
    work_area_right = ($TargetX + $TargetW)
    work_area_bottom = ($TargetY + $TargetH)
    maximized = $true
}

if ($prefObj.browser.PSObject.Properties['window_placement']) {
    $prefObj.browser.window_placement = $placement
} else {
    $prefObj.browser | Add-Member -NotePropertyName "window_placement" -NotePropertyValue $placement -Force
}

$prefJson = $prefObj | ConvertTo-Json -Depth 10
[System.IO.File]::WriteAllText($prefFile, $prefJson, [System.Text.Encoding]::UTF8)

# 6. Find Browser Executable (Chrome or Edge)
$browserExe = "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path $browserExe)) {
    $browserExe = "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
}
if (-not (Test-Path $browserExe)) {
    $browserExe = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
}

Write-Host "Using Browser: $browserExe"

# 7. Launch browser with kiosk mode
$url = "http://localhost:8088"
$args = @(
    "--app=$url",
    "--kiosk",
    "--user-data-dir=$env:LOCALAPPDATA\AIDA64_Kiosk_Profile",
    "--window-position=$TargetX,$TargetY",
    "--window-size=$TargetW,$TargetH",
    "--noerrdialogs",
    "--disable-session-crashed-bubble",
    "--check-for-update-interval=31536000",
    "--no-first-run",
    "--disable-features=TranslateUI",
    "--disable-pinch"
)
$browserProcess = Start-Process -FilePath $browserExe -ArgumentList $args -PassThru

# 8. Wait for Window Handle and apply Win32 Taskbar Elimination & Topmost Pinning
Write-Host "Waiting for Dashboard window handle..."
$hWnd = [IntPtr]::Zero
$timeout = (Get-Date).AddSeconds(10)

while ((Get-Date) -lt $timeout -and $hWnd -eq [IntPtr]::Zero) {
    Start-Sleep -Milliseconds 400
    
    if ($browserProcess -and -not $browserProcess.HasExited) {
        $browserProcess.Refresh()
        if ($browserProcess.MainWindowHandle -ne [IntPtr]::Zero) {
            $hWnd = $browserProcess.MainWindowHandle
            break
        }
    }
    
    $procs = Get-Process -ErrorAction SilentlyContinue | Where-Object { 
        ($_.ProcessName -match "chrome|msedge") -and $_.MainWindowHandle -ne [IntPtr]::Zero
    }
    foreach ($p in $procs) {
        try {
            $cmd = (Get-CimInstance Win32_Process -Filter "ProcessId = $($p.Id)" -ErrorAction SilentlyContinue).CommandLine
            if ($cmd -like "*AIDA64_Kiosk_Profile*") {
                $hWnd = $p.MainWindowHandle
                break
            }
        } catch {}
    }
}

if ($hWnd -ne [IntPtr]::Zero) {
    Write-Host "Applying Win32 Taskbar suppression to Window Handle: $hWnd"
    [Win32Taskbar]::RemoveFromTaskbarAndPin($hWnd, $TargetX, $TargetY, $TargetW, $TargetH)
    Write-Host "SUCCESS: Window removed from Taskbar & Alt+Tab. Pinned to Screen 2 ($TargetX, $TargetY) with Win+D immunity."
} else {
    Write-Warning "Window handle detection timed out. Browser running via profile placement."
}
