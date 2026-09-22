# ==============================================================================
# AIDA64 Glassmorphism 2.0 Dashboard - Multi-Monitor Detector
# Identifies secondary displays and dedicated small sensor panel screens
# ==============================================================================

[CmdletBinding()]
param (
    [string]$OutputFile = "",
    [string]$TargetIndex = $env:AIDA64_SCREEN_INDEX,
    [string]$TargetName = $env:AIDA64_SCREEN_NAME,
    [string]$ManualPosition = $env:AIDA64_WINDOW_POSITION
)

$ErrorActionPreference = 'SilentlyContinue'

try {
    Add-Type -AssemblyName System.Windows.Forms
} catch {
    Write-Warning "Could not load System.Windows.Forms. Using fallback coordinates (0, 0)."
}

$allScreens = [System.Windows.Forms.Screen]::AllScreens
$screenCount = if ($allScreens) { $allScreens.Count } else { 1 }

# Display Diagnostic Banner
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host " [AIDA64 DISPLAY DETECTOR] Total Monitors Detected: $screenCount" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan

for ($i = 0; $i -lt $screenCount; $i++) {
    $s = $allScreens[$i]
    $isPrimary = if ($s.Primary) { "[PRIMARY]" } else { "         " }
    $area = $s.Bounds.Width * $s.Bounds.Height
    Write-Host ("  [{0}] {1} {2} | Res: {3}x{4} | Pos: ({5}, {6})" -f `
        ($i + 1), $isPrimary, $s.DeviceName, $s.Bounds.Width, $s.Bounds.Height, $s.Bounds.X, $s.Bounds.Y) -ForegroundColor Gray
}

# Determine Target Screen
$target = $null

# 1. Check for manual coordinate override (X,Y)
if (![string]::IsNullOrWhiteSpace($ManualPosition) -and $ManualPosition -match '^(-?\d+),(-?\d+)$') {
    $mX = [int]$matches[1]
    $mY = [int]$matches[2]
    Write-Host "[OVERRIDE] Using explicit window position: ($mX, $mY)" -ForegroundColor Green
    $screenX = $mX
    $screenY = $mY
    $screenW = 1920
    $screenH = 1080
    $screenDevice = "MANUAL_OVERRIDE"
    $isPrimaryTarget = $false
} else {
    # 2. Check for explicit index override (1-based)
    if (![string]::IsNullOrWhiteSpace($TargetIndex)) {
        $idx = [int]$TargetIndex - 1
        if ($idx -ge 0 -and $idx -lt $screenCount) {
            $target = $allScreens[$idx]
            Write-Host "[OVERRIDE] Selected Screen by Index: $TargetIndex ($($target.DeviceName))" -ForegroundColor Yellow
        }
    }

    # 3. Check for explicit name override (e.g. DISPLAY4)
    if (-not $target -and ![string]::IsNullOrWhiteSpace($TargetName)) {
        $target = $allScreens | Where-Object { $_.DeviceName -like "*$TargetName*" } | Select-Object -First 1
        if ($target) {
            Write-Host "[OVERRIDE] Selected Screen by Device Name: $TargetName" -ForegroundColor Yellow
        }
    }

    # 4. Automatic Screen Selection
    if (-not $target) {
        if ($screenCount -le 1) {
            # Single monitor setup: use primary
            $target = [System.Windows.Forms.Screen]::PrimaryScreen
            Write-Host "[AUTO] Single monitor detected. Targeting primary display." -ForegroundColor Yellow
        } else {
            # Multi-monitor setup: find non-primary screens
            $nonPrimary = $allScreens | Where-Object { -not $_.Primary }
            
            # Prioritize Screen 2 (Top-Right above Screen 3: 1920x1200 at X=3840, Y=-1200):
            $matchScreen2 = $nonPrimary | Where-Object { $_.DeviceName -eq '\\.\DISPLAY3' -or ($_.Bounds.X -ge 3840 -and $_.Bounds.Y -lt 0) } | Select-Object -First 1
            if ($matchScreen2) {
                $target = $matchScreen2
                Write-Host "[AUTO] Screen 2 (Top-Right: 1920x1200) matched: $($target.DeviceName)" -ForegroundColor Green
            } else {
                # Fallback to smallest resolution area
                $smallest = $nonPrimary | Sort-Object { $_.Bounds.Width * $_.Bounds.Height } | Select-Object -First 1
                if ($smallest) {
                    $target = $smallest
                    Write-Host "[AUTO] Dedicated/Smallest secondary monitor selected: $($target.DeviceName)" -ForegroundColor Green
                } else {
                    $target = $nonPrimary[0]
                    Write-Host "[AUTO] First secondary monitor selected: $($target.DeviceName)" -ForegroundColor Green
                }
            }
        }
    }

    if (-not $target) {
        $target = [System.Windows.Forms.Screen]::PrimaryScreen
    }

    if ($target.DeviceName -eq '\\.\DISPLAY3' -or ($target.Bounds.X -ge 3840 -and $target.Bounds.Y -lt 0)) {
        $screenX = 3840
        $screenY = -1200
        $screenW = 1920
        $screenH = 1200
    } else {
        $screenX = $target.Bounds.X
        $screenY = $target.Bounds.Y
        $screenW = $target.Bounds.Width
        $screenH = $target.Bounds.Height
    }
    $screenDevice = $target.DeviceName
    $isPrimaryTarget = $target.Primary
}

Write-Host "------------------------------------------------------------------" -ForegroundColor Cyan
Write-Host (" [TARGET IDENTIFIED] Device: {0} | Coordinates: ({1}, {2}) | Size: {3}x{4}" -f `
    $screenDevice, $screenX, $screenY, $screenW, $screenH) -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Cyan

# Generate Batch Output File if requested
if (![string]::IsNullOrWhiteSpace($OutputFile)) {
    $batchContent = @"
@echo off
set "SCREEN_X=$screenX"
set "SCREEN_Y=$screenY"
set "SCREEN_W=$screenW"
set "SCREEN_H=$screenH"
set "SCREEN_NAME=$screenDevice"
set "SCREEN_COUNT=$screenCount"
set "SCREEN_IS_PRIMARY=$isPrimaryTarget"
"@
    [System.IO.File]::WriteAllText($OutputFile, $batchContent, [System.Text.Encoding]::ASCII)
}

# Return structured result object
[PSCustomObject]@{
    Count     = $screenCount
    TargetX   = $screenX
    TargetY   = $screenY
    TargetW   = $screenW
    TargetH   = $screenH
    Device    = $screenDevice
    IsPrimary = $isPrimaryTarget
}
