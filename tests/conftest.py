"""
Pytest configuration and platform compatibility fixtures.
Enables mock execution of Windows-specific APIs (winreg, ctypes.windll)
when running test suites in non-Windows environments (such as Ubuntu CI runners).
"""

import sys
from unittest.mock import MagicMock

# If running on non-Windows platforms (e.g. Linux CI/container mock), setup mocks
if sys.platform != "win32":
    # 1. Mock Windows Registry module (winreg)
    mock_winreg = MagicMock()
    mock_winreg.HKEY_CURRENT_USER = 1
    mock_winreg.KEY_READ = 1
    mock_winreg.OpenKey.side_effect = OSError("Windows registry unavailable on non-Windows host")
    sys.modules["winreg"] = mock_winreg

    # 2. Mock ctypes.windll and kernel32
    import ctypes
    if not hasattr(ctypes, "windll"):
        mock_kernel32 = MagicMock()
        mock_kernel32.OpenFileMappingW.return_value = None
        mock_kernel32.MapViewOfFile.return_value = None
        mock_kernel32.UnmapViewOfFile.return_value = True
        mock_kernel32.CloseHandle.return_value = True
        mock_kernel32.GetCurrentProcess.return_value = 1
        mock_kernel32.GetProcessHandleCount.return_value = True

        mock_windll = MagicMock()
        mock_windll.kernel32 = mock_kernel32
        ctypes.windll = mock_windll
