# ==============================================================================
# Install AIDA64 Dashboard into Windows Startup and Desktop Shortcut
# ==============================================================================

$repoRoot = Split-Path -Parent $PSScriptRoot
$runBgVbs = Join-Path $PSScriptRoot 'run_background.vbs'

$startupDir = [Environment]::GetFolderPath('Startup')
$startupVbs = Join-Path $startupDir 'AIDA64-Dashboard-Kiosk.vbs'

$vbsContent = @"
' ==============================================================================
' AIDA64 Dashboard - Silent Startup Launcher
' ==============================================================================
Option Explicit

Dim WshShell
Set WshShell = CreateObject("WScript.Shell")

' Wait 5 seconds to ensure system services, network and AIDA64 are initialized
WScript.Sleep 5000

' Launch silent orchestrator
WshShell.Run "wscript.exe ""$runBgVbs""", 0, False
Set WshShell = Nothing
"@

[System.IO.File]::WriteAllText($startupVbs, $vbsContent, [System.Text.Encoding]::ASCII)
Write-Host "Created Startup Script: $startupVbs"

# Locate Icon
$iconPath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path $iconPath)) {
    $iconPath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
}

# Update all Desktop directories (OneDrive + Local)
$userProfile = [Environment]::GetFolderPath('UserProfile')
$desktopDirs = @(
    [Environment]::GetFolderPath('Desktop'),
    [System.IO.Path]::Combine($userProfile, 'OneDrive', 'Desktop'),
    [System.IO.Path]::Combine($userProfile, 'Desktop')
) | Select-Object -Unique | Where-Object { Test-Path $_ }

$wsh = New-Object -ComObject WScript.Shell
foreach ($d in $desktopDirs) {
    $shortcutPath = Join-Path $d 'AIDA64 Dashboard.lnk'
    $shortcut = $wsh.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = 'wscript.exe'
    $shortcut.Arguments = "`"$runBgVbs`""
    $shortcut.WorkingDirectory = $repoRoot
    $shortcut.Description = 'AIDA64 Glassmorphism 2.0 Kiosk Dashboard'
    if (Test-Path $iconPath) {
        $shortcut.IconLocation = "$iconPath,0"
    }
    $shortcut.Save()
    Write-Host "Created Desktop Shortcut: $shortcutPath"
}
