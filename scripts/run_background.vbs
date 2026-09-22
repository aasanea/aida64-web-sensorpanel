' ==============================================================================
' AIDA64 Glassmorphism 2.0 Dashboard - Silent Background Launcher
' Executes start.bat silently with WindowStyle 0 (hidden console)
' Suitable for shell:startup, Windows Startup Folder, or Task Scheduler
' ==============================================================================

Option Explicit

Dim objShell, objFSO, strScriptDir, strBatPath

Set objShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")

' Resolve the path to launch_kiosk.bat
strScriptDir = objFSO.GetParentFolderName(WScript.ScriptFullName)
strBatPath = objFSO.GetParentFolderName(strScriptDir) & "\launch_kiosk.bat"

' Validate that launch_kiosk.bat exists
If Not objFSO.FileExists(strBatPath) Then
    strBatPath = strScriptDir & "\start.bat"
End If

' Set current working directory
objShell.CurrentDirectory = objFSO.GetParentFolderName(strBatPath)

' Launch start.bat silently:
' WindowStyle = 0 (Hidden - suppresses any flashing command prompt window)
' bWaitOnReturn = False (Asynchronous - launcher exits immediately)
objShell.Run Chr(34) & strBatPath & Chr(34), 0, False

Set objShell = Nothing
Set objFSO = Nothing
