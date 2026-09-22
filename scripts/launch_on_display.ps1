# ==============================================================================
# AIDA64 Dashboard - Reliable Display Placer & Kiosk Launcher
# Target: Screen 2 (Top-Right above Screen 3: 1920x1200 at 3840, -1200)
# ==============================================================================
param(
    [int]$TargetX = 3840,
    [int]$TargetY = -1200,
    [int]$TargetW = 1920,
    [int]$TargetH = 1200
)

# 1. Ensure backend is running
$healthUrl = "http://localhost:8088/health"
$healthy = $false
try {
    $res = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 2 -ErrorAction SilentlyContinue
    if ($res.status -eq 'healthy') { $healthy = $true }
} catch {}

if (-not $healthy) {
    $backendDir = Join-Path (Split-Path -Parent $PSScriptRoot) "backend"
    Start-Process python -ArgumentList "-m uvicorn main:app --host 0.0.0.0 --port 8088" -WorkingDirectory $backendDir -WindowStyle Hidden
    Start-Sleep -Seconds 2
}

# 2. Terminate any previous stuck kiosk instance first so it doesn't overwrite Preferences on exit
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*AIDA64_Kiosk_Profile*" } | ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Milliseconds 800

# 3. Determine target display coordinates dynamically (Screen 2: 1920x1200 at X=3840, Y=-1200)
Add-Type -AssemblyName System.Windows.Forms
$screens = [System.Windows.Forms.Screen]::AllScreens
$targetScreen = $screens | Where-Object { 
    $_.DeviceName -eq '\\.\DISPLAY3' -or ($_.Bounds.X -ge 3840 -and $_.Bounds.Y -lt 0)
} | Select-Object -First 1

if ($targetScreen) {
    $TargetX = $targetScreen.Bounds.X
    $TargetY = $targetScreen.Bounds.Y
    $TargetW = 1920
    $TargetH = 1200
} else {
    $TargetX = 3840
    $TargetY = -1200
    $TargetW = 1920
    $TargetH = 1200
}

Write-Host "Target Screen Identified: Screen 2 ($TargetX, $TargetY) Size: ${TargetW}x${TargetH}"

# 4. Pre-seed Chrome / Edge dedicated Kiosk Profile with exact window placement for Screen 2
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

# 5. Find Browser Executable (Chrome or Edge)
$browserExe = "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path $browserExe)) {
    $browserExe = "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
}
if (-not (Test-Path $browserExe)) {
    $browserExe = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
}

Write-Host "Using Browser: $browserExe"

# 6. Launch browser with kiosk and position flags
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
    "--no-first-run"
)
Start-Process -FilePath $browserExe -ArgumentList $args
Write-Host "Kiosk launcher completed successfully on Screen 2 ($TargetX, $TargetY)."
