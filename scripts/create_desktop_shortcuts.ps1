# ==============================================================================
# Create Desktop Shortcuts for AIDA64 Display Switcher Scripts
# ==============================================================================

$repoRoot = Split-Path -Parent $PSScriptRoot
$primaryBat = Join-Path $repoRoot 'show_on_primary.bat'
$dedicatedBat = Join-Path $repoRoot 'show_on_dedicated.bat'
$iconPath = Join-Path $repoRoot 'bin\icon.ico'
if (-not (Test-Path $iconPath)) {
    $iconPath = Join-Path $repoRoot 'host\icon.ico'
}

$userProfile = [Environment]::GetFolderPath('UserProfile')
$desktopDirs = @(
    [Environment]::GetFolderPath('Desktop'),
    [System.IO.Path]::Combine($userProfile, 'OneDrive', 'Desktop'),
    [System.IO.Path]::Combine($userProfile, 'Desktop')
) | Select-Object -Unique | Where-Object { Test-Path $_ }

$wsh = New-Object -ComObject WScript.Shell

foreach ($d in $desktopDirs) {
    # 1. Primary Screen Shortcut
    $scPrimaryPath = Join-Path $d 'AIDA64 - Show on Primary.lnk'
    $scPrimary = $wsh.CreateShortcut($scPrimaryPath)
    $scPrimary.TargetPath = $primaryBat
    $scPrimary.WorkingDirectory = $repoRoot
    $scPrimary.Description = 'AIDA64 SensorPanel - Show on Primary Display (0,0)'
    if (Test-Path $iconPath) {
        $scPrimary.IconLocation = "$iconPath,0"
    }
    $scPrimary.Save()
    Write-Host "Created Shortcut: $scPrimaryPath" -ForegroundColor Green

    # 2. Dedicated Screen Shortcut
    $scDedicatedPath = Join-Path $d 'AIDA64 - Show on Dedicated.lnk'
    $scDedicated = $wsh.CreateShortcut($scDedicatedPath)
    $scDedicated.TargetPath = $dedicatedBat
    $scDedicated.WorkingDirectory = $repoRoot
    $scDedicated.Description = 'AIDA64 SensorPanel - Move to Dedicated Secondary Display (3840,-1200)'
    if (Test-Path $iconPath) {
        $scDedicated.IconLocation = "$iconPath,0"
    }
    $scDedicated.Save()
    Write-Host "Created Shortcut: $scDedicatedPath" -ForegroundColor Green
}

Write-Host "All Desktop shortcuts created successfully." -ForegroundColor Cyan
