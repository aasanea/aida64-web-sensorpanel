using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net.Http;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Win32;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace AIDA64Panel
{
    static class Program
    {
        private static readonly string LogFile = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "host.log");
        public const string MutexName = "AIDA64_SensorPanel_Host_Mutex";
        public const string ShowSignalEventName = "AIDA64_SensorPanel_Show_Signal";
        public const string PrimarySignalEventName = "AIDA64_SensorPanel_Primary_Signal";
        public const string DedicatedSignalEventName = "AIDA64_SensorPanel_Dedicated_Signal";
        public const string ToggleSignalEventName = "AIDA64_SensorPanel_Toggle_Signal";

        public static void Log(string msg)
        {
            try
            {
                File.AppendAllText(LogFile, $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff}] {msg}\r\n");
            }
            catch { }
        }

        public static bool TrySignalEvent(string eventName)
        {
            try
            {
                if (EventWaitHandle.TryOpenExisting(eventName, out var handle))
                {
                    using (handle)
                    {
                        handle.Set();
                    }
                    return true;
                }
            }
            catch (Exception ex)
            {
                Log($"Failed to open or set event '{eventName}': {ex.Message}");
            }
            return false;
        }

        [STAThread]
        static void Main(string[] args)
        {
            Log($"AIDA64Panel starting with args: [{string.Join(" ", args)}]");

            bool createdNew;
            Mutex? mutex = null;
            try
            {
                mutex = new Mutex(true, MutexName, out createdNew);
            }
            catch (AbandonedMutexException)
            {
                createdNew = true;
            }

            if (!createdNew)
            {
                Log($"Existing instance detected. Checking arguments: [{string.Join(" ", args)}]");

                bool isPrimary = false;
                bool isDedicated = false;
                bool isToggle = false;

                if (args != null && args.Length > 0)
                {
                    foreach (var arg in args)
                    {
                        if (arg.Equals("--primary", StringComparison.OrdinalIgnoreCase) ||
                            arg.Equals("-p", StringComparison.OrdinalIgnoreCase) ||
                            arg.Equals("/primary", StringComparison.OrdinalIgnoreCase) ||
                            arg.Equals("--main", StringComparison.OrdinalIgnoreCase))
                        {
                            isPrimary = true;
                            break;
                        }
                        else if (arg.Equals("--dedicated", StringComparison.OrdinalIgnoreCase) ||
                                 arg.Equals("-d", StringComparison.OrdinalIgnoreCase) ||
                                 arg.Equals("/dedicated", StringComparison.OrdinalIgnoreCase) ||
                                 arg.Equals("--lcd", StringComparison.OrdinalIgnoreCase))
                        {
                            isDedicated = true;
                            break;
                        }
                        else if (arg.Equals("--toggle", StringComparison.OrdinalIgnoreCase) ||
                                 arg.Equals("-t", StringComparison.OrdinalIgnoreCase) ||
                                 arg.Equals("/toggle", StringComparison.OrdinalIgnoreCase))
                        {
                            isToggle = true;
                            break;
                        }
                    }
                }

                if (isPrimary)
                {
                    Log("Signaling primary display relocation...");
                    if (TrySignalEvent(PrimarySignalEventName))
                    {
                        Log("Primary signal sent to running instance. Exiting secondary process.");
                        return;
                    }
                    Log("Primary signal event not found, falling back to show signal...");
                }
                else if (isDedicated)
                {
                    Log("Signaling dedicated display relocation...");
                    if (TrySignalEvent(DedicatedSignalEventName))
                    {
                        Log("Dedicated signal sent to running instance. Exiting secondary process.");
                        return;
                    }
                    Log("Dedicated signal event not found, falling back to show signal...");
                }
                else if (isToggle)
                {
                    Log("Signaling toggle visibility...");
                    if (TrySignalEvent(ToggleSignalEventName))
                    {
                        Log("Toggle signal sent to running instance. Exiting secondary process.");
                        return;
                    }
                    Log("Toggle signal event not found, falling back to show signal...");
                }

                // Default: signal activation/show
                Log("Signaling activation (show)...");
                if (TrySignalEvent(ShowSignalEventName))
                {
                    Log("Show signal sent to running instance. Exiting secondary process.");
                    return;
                }

                // If signal could not be sent and another process exists
                var procs = Process.GetProcessesByName("AIDA64Panel");
                if (procs.Length > 1)
                {
                    MessageBox.Show("لوحة AIDA64 تعمل بالفعل في صينية النظام بجوار الساعة ⚡", "لوحة المراقبة AIDA64", MessageBoxButtons.OK, MessageBoxIcon.Information);
                    return;
                }
            }

            try
            {
                ApplicationConfiguration.Initialize();
                Log("ApplicationConfiguration initialized.");
                Application.Run(new DashboardHostForm(args));
            }
            catch (Exception ex)
            {
                Log($"Fatal Exception in Main: {ex}");
                MessageBox.Show($"خطأ أثناء تشغيل اللوحة:\n{ex.Message}", "خطأ فادح", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
            finally
            {
                mutex?.Dispose();
            }
        }
    }

    public static class JobManager
    {
        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        private static extern IntPtr CreateJobObject(IntPtr lpJobAttributes, string? lpName);

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool SetInformationJobObject(
            IntPtr hJob,
            JobObjectInfoClass JobObjectInformationClass,
            IntPtr lpJobObjectInformation,
            uint cbJobObjectInformationLength);

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool AssignProcessToJobObject(IntPtr hJob, IntPtr hProcess);

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool CloseHandle(IntPtr hObject);

        private enum JobObjectInfoClass
        {
            BasicLimitInformation = 2,
            ExtendedLimitInformation = 9
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct IO_COUNTERS
        {
            public ulong ReadOperationCount;
            public ulong WriteOperationCount;
            public ulong OtherOperationCount;
            public ulong ReadTransferCount;
            public ulong WriteTransferCount;
            public ulong OtherTransferCount;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct JOBOBJECT_BASIC_LIMIT_INFORMATION
        {
            public long PerProcessUserTimeLimit;
            public long PerJobUserTimeLimit;
            public uint LimitFlags;
            public UIntPtr MinimumWorkingSetSize;
            public UIntPtr MaximumWorkingSetSize;
            public uint ActiveProcessLimit;
            public UIntPtr Affinity;
            public uint PriorityClass;
            public uint SchedulingClass;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct JOBOBJECT_EXTENDED_LIMIT_INFORMATION
        {
            public JOBOBJECT_BASIC_LIMIT_INFORMATION BasicLimitInformation;
            public IO_COUNTERS IoInfo;
            public UIntPtr ProcessMemoryLimit;
            public UIntPtr JobMemoryLimit;
            public UIntPtr PeakProcessMemoryLimit;
            public UIntPtr PeakJobMemoryLimit;
        }

        private const uint JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x2000;

        private static readonly IntPtr s_jobHandle = IntPtr.Zero;

        static JobManager()
        {
            try
            {
                s_jobHandle = CreateJobObject(IntPtr.Zero, null);
                if (s_jobHandle == IntPtr.Zero)
                {
                    Program.Log($"JobManager: Failed to create job object, Win32 Error: {Marshal.GetLastWin32Error()}");
                    return;
                }

                var info = new JOBOBJECT_EXTENDED_LIMIT_INFORMATION();
                info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;

                int length = Marshal.SizeOf(typeof(JOBOBJECT_EXTENDED_LIMIT_INFORMATION));
                IntPtr extendedInfoPtr = Marshal.AllocHGlobal(length);
                try
                {
                    Marshal.StructureToPtr(info, extendedInfoPtr, false);
                    if (!SetInformationJobObject(s_jobHandle, JobObjectInfoClass.ExtendedLimitInformation, extendedInfoPtr, (uint)length))
                    {
                        Program.Log($"JobManager: Failed to set JobObject limit info, Win32 Error: {Marshal.GetLastWin32Error()}");
                    }
                    else
                    {
                        Program.Log("JobManager: Job Object created and configured with JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE.");
                    }
                }
                finally
                {
                    Marshal.FreeHGlobal(extendedInfoPtr);
                }
            }
            catch (Exception ex)
            {
                Program.Log($"JobManager initialization exception: {ex.Message}");
            }
        }

        public static bool Attach(Process process)
        {
            if (s_jobHandle == IntPtr.Zero)
            {
                Program.Log("JobManager.Attach failed: Job handle is invalid.");
                return false;
            }

            try
            {
                if (process.HasExited)
                {
                    Program.Log("JobManager.Attach: Process already exited.");
                    return false;
                }

                bool success = AssignProcessToJobObject(s_jobHandle, process.Handle);
                if (!success)
                {
                    int err = Marshal.GetLastWin32Error();
                    Program.Log($"JobManager: AssignProcessToJobObject failed for PID {process.Id}, Win32 Error: {err}");
                }
                else
                {
                    Program.Log($"JobManager: Successfully attached process PID {process.Id} to Job Object.");
                }
                return success;
            }
            catch (Exception ex)
            {
                Program.Log($"JobManager.Attach exception for PID {process.Id}: {ex.Message}");
                return false;
            }
        }
    }

    public class DashboardHostForm : Form
    {
        private WebView2 _webView = null!;
        private NotifyIcon? _trayIcon;
        private ContextMenuStrip? _trayMenu;
        private ToolStripMenuItem? _topmostItem;
        private ToolStripMenuItem? _autoStartItem;
        private int _currentScreenIndex = 0;
        private bool _startOnPrimary = false;
        private const string DashboardUrl = "http://127.0.0.1:8088";
        private const string HealthUrl = "http://127.0.0.1:8088/health";
        private const string AutoStartKeyName = "AIDA64WebSensorPanel";

        private static readonly HttpClient _httpClient = new HttpClient
        {
            Timeout = TimeSpan.FromSeconds(2)
        };
        private static bool _isRecovering = false;
        private static readonly object _recoveryLock = new object();
        private static Process? _backendProcess = null;
        private System.Windows.Forms.Timer? _watchdogTimer;

        private EventWaitHandle? _showSignalEvent;
        private RegisteredWaitHandle? _registeredShowWait;

        private EventWaitHandle? _primarySignalEvent;
        private RegisteredWaitHandle? _registeredPrimaryWait;

        private EventWaitHandle? _dedicatedSignalEvent;
        private RegisteredWaitHandle? _registeredDedicatedWait;

        private EventWaitHandle? _toggleSignalEvent;
        private RegisteredWaitHandle? _registeredToggleWait;

        private ToolStripMenuItem? _taskbarItem;
        private bool _showInTaskbarEnabled = false;

        private const string SettingsRegistryKey = @"Software\AIDA64Panel";
        private const string ShowInTaskbarValueName = "ShowInTaskbar";

        private const int GWL_EXSTYLE = -20;
        private const int WS_EX_TOOLWINDOW = 0x00000080;
        private const int WS_EX_APPWINDOW = 0x00040000;
        private const uint SWP_NOZORDER = 0x0004;
        private const uint SWP_FRAMECHANGED = 0x0020;

        [ComImport]
        [Guid("56FDF344-FD6D-11d0-958A-006097C9A090")]
        [ClassInterface(ClassInterfaceType.None)]
        private class TaskbarInstance { }

        [ComImport]
        [Guid("56FDF342-FD6D-11d0-958A-006097C9A090")]
        [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        private interface ITaskbarList
        {
            [PreserveSig]
            int HrInit();
            [PreserveSig]
            int AddTab(IntPtr hWnd);
            [PreserveSig]
            int DeleteTab(IntPtr hWnd);
            [PreserveSig]
            int ActivateTab(IntPtr hWnd);
            [PreserveSig]
            int SetActiveAlt(IntPtr hWnd);
        }

        private ITaskbarList? _taskbarList;

        [DllImport("user32.dll", EntryPoint = "GetWindowLongPtr", SetLastError = true)]
        private static extern IntPtr GetWindowLongPtr64(IntPtr hWnd, int nIndex);

        [DllImport("user32.dll", EntryPoint = "GetWindowLong", SetLastError = true)]
        private static extern IntPtr GetWindowLong32(IntPtr hWnd, int nIndex);

        private static IntPtr GetWindowLongPtr(IntPtr hWnd, int nIndex)
        {
            return IntPtr.Size == 8 ? GetWindowLongPtr64(hWnd, nIndex) : GetWindowLong32(hWnd, nIndex);
        }

        [DllImport("user32.dll", EntryPoint = "SetWindowLongPtr", SetLastError = true)]
        private static extern IntPtr SetWindowLongPtr64(IntPtr hWnd, int nIndex, IntPtr dwNewLong);

        [DllImport("user32.dll", EntryPoint = "SetWindowLong", SetLastError = true)]
        private static extern IntPtr SetWindowLong32(IntPtr hWnd, int nIndex, IntPtr dwNewLong);

        private static IntPtr SetWindowLongPtr(IntPtr hWnd, int nIndex, IntPtr dwNewLong)
        {
            return IntPtr.Size == 8 ? SetWindowLongPtr64(hWnd, nIndex, dwNewLong) : SetWindowLong32(hWnd, nIndex, dwNewLong);
        }

        private static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);
        private static readonly IntPtr HWND_NOTOPMOST = new IntPtr(-2);
        private const uint SWP_NOSIZE = 0x0001;
        private const uint SWP_NOMOVE = 0x0002;
        private const uint SWP_SHOWWINDOW = 0x0040;

        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

        [DllImport("user32.dll", CharSet = CharSet.Auto)]
        private static extern int RegisterWindowMessage(string lpString);

        private int _wmTaskbarCreated = 0;

        public DashboardHostForm(string[] args)
        {
            Program.Log("DashboardHostForm constructor called.");
            _wmTaskbarCreated = RegisterWindowMessage("TaskbarCreated");
            _showInTaskbarEnabled = LoadTaskbarPreference();

            bool dedicatedRequested = false;
            if (args != null && args.Length > 0)
            {
                foreach (var arg in args)
                {
                    if (arg.Equals("--primary", StringComparison.OrdinalIgnoreCase) ||
                        arg.Equals("-p", StringComparison.OrdinalIgnoreCase) ||
                        arg.Equals("/primary", StringComparison.OrdinalIgnoreCase) ||
                        arg.Equals("--main", StringComparison.OrdinalIgnoreCase))
                    {
                        _startOnPrimary = true;
                        Program.Log("Startup argument: --primary/--main detected.");
                    }
                    else if (arg.Equals("--dedicated", StringComparison.OrdinalIgnoreCase) ||
                             arg.Equals("-d", StringComparison.OrdinalIgnoreCase) ||
                             arg.Equals("/dedicated", StringComparison.OrdinalIgnoreCase) ||
                             arg.Equals("--lcd", StringComparison.OrdinalIgnoreCase))
                    {
                        dedicatedRequested = true;
                        Program.Log("Startup argument: --dedicated/--lcd detected.");
                    }
                    else if (arg.Equals("--taskbar", StringComparison.OrdinalIgnoreCase))
                    {
                        _showInTaskbarEnabled = true;
                    }
                    else if (arg.Equals("--no-taskbar", StringComparison.OrdinalIgnoreCase))
                    {
                        _showInTaskbarEnabled = false;
                    }
                }
            }

            // Default to primary display unless dedicated was explicitly requested
            _startOnPrimary = !dedicatedRequested;

            InitializeWindow();
            InitializeTray();
            SetupIpcSignal();
        }

        protected override CreateParams CreateParams
        {
            get
            {
                CreateParams cp = base.CreateParams;
                if (_showInTaskbarEnabled)
                {
                    cp.ExStyle |= WS_EX_APPWINDOW;
                    cp.ExStyle &= ~WS_EX_TOOLWINDOW;
                }
                else
                {
                    cp.ExStyle |= WS_EX_TOOLWINDOW;
                    cp.ExStyle &= ~WS_EX_APPWINDOW;
                }
                return cp;
            }
        }

        private void InitializeWindow()
        {
            this.Text = "AIDA64 Dashboard";
            this.FormBorderStyle = FormBorderStyle.None;
            this.ShowInTaskbar = _showInTaskbarEnabled;
            this.StartPosition = FormStartPosition.Manual;
            this.TopMost = true;
            this.BackColor = Color.FromArgb(10, 15, 30);

            _webView = new WebView2
            {
                Dock = DockStyle.Fill
            };
            this.Controls.Add(_webView);

            if (_startOnPrimary)
            {
                MoveToPrimaryDisplay();
            }
            else
            {
                PositionOnTargetDisplay();
            }
            Program.Log($"InitializeWindow complete. Form Bounds: {this.Bounds}");
        }

        private Icon LoadPanelIcon()
        {
            try
            {
                string iconPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "icon.ico");
                if (File.Exists(iconPath))
                {
                    Program.Log($"Loading icon from file: {iconPath}");
                    return new Icon(iconPath);
                }

                var assocIcon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
                if (assocIcon != null)
                {
                    Program.Log("Loaded icon from Executable resources.");
                    return assocIcon;
                }
            }
            catch (Exception ex)
            {
                Program.Log($"Icon load fallback due to: {ex.Message}");
            }

            return SystemIcons.Application;
        }

        private void InitializeTray()
        {
            var appIcon = LoadPanelIcon();
            this.Icon = appIcon;

            _trayMenu = new ContextMenuStrip();
            _trayMenu.RightToLeft = RightToLeft.Yes;

            var dedicatedItem = new ToolStripMenuItem("🖥️ الشاشة المخصصة (Dedicated 1920x1200)", null, (s, e) => MoveToDedicatedDisplay());
            var primaryItem = new ToolStripMenuItem("💻 الشاشة الرئيسية (Primary Display)", null, (s, e) => MoveToPrimaryDisplay());
            var cycleItem = new ToolStripMenuItem("🔄 تبديل الشاشات (Cycle Displays)", null, OnSwitchScreen);

            _topmostItem = new ToolStripMenuItem("📌 تثبيت في المقدمة (Always On Top)", null, OnToggleTopMost)
            {
                CheckOnClick = true,
                Checked = this.TopMost
            };

            _taskbarItem = new ToolStripMenuItem("📌 إظهار في شريط المهام (Show in Taskbar)", null, OnToggleTaskbar)
            {
                CheckOnClick = true,
                Checked = _showInTaskbarEnabled
            };

            var refreshItem = new ToolStripMenuItem("🔄 تحديث اللوحة (Reload)", null, OnRefreshDashboard);
            var toggleItem = new ToolStripMenuItem("👁️ إخفاء / إظهار (Toggle Visibility)", null, OnToggleVisibility);

            _autoStartItem = new ToolStripMenuItem("⚙️ التشغيل التلقائي مع ويندوز (Auto-Start)", null, OnToggleAutoStart)
            {
                CheckOnClick = true,
                Checked = IsAutoStartEnabled()
            };

            var exitItem = new ToolStripMenuItem("❌ إغلاق اللوحة (Exit)", null, OnExitApplication);

            _trayMenu.Items.Add(dedicatedItem);
            _trayMenu.Items.Add(primaryItem);
            _trayMenu.Items.Add(cycleItem);
            _trayMenu.Items.Add(new ToolStripSeparator());
            _trayMenu.Items.Add(_topmostItem);
            _trayMenu.Items.Add(_taskbarItem);
            _trayMenu.Items.Add(refreshItem);
            _trayMenu.Items.Add(toggleItem);
            _trayMenu.Items.Add(new ToolStripSeparator());
            _trayMenu.Items.Add(_autoStartItem);
            _trayMenu.Items.Add(new ToolStripSeparator());
            _trayMenu.Items.Add(exitItem);

            _trayIcon = new NotifyIcon
            {
                Text = "AIDA64 SensorPanel Host",
                Icon = appIcon,
                ContextMenuStrip = _trayMenu,
                Visible = true
            };

            _trayIcon.DoubleClick += (s, e) => OnToggleVisibility(s, e);
            Program.Log("Tray icon initialized successfully.");
        }

        private bool LoadTaskbarPreference()
        {
            try
            {
                using var key = Registry.CurrentUser.OpenSubKey(SettingsRegistryKey, false);
                var val = key?.GetValue(ShowInTaskbarValueName);
                if (val is int intVal) return intVal != 0;
            }
            catch { }
            return false; // Default: Clean Zero-Taskbar Mode
        }

        private void SaveTaskbarPreference(bool enabled)
        {
            try
            {
                using var key = Registry.CurrentUser.CreateSubKey(SettingsRegistryKey, true);
                key?.SetValue(ShowInTaskbarValueName, enabled ? 1 : 0, RegistryValueKind.DWord);
            }
            catch { }
        }

        private void EnsureTaskbarList()
        {
            if (_taskbarList == null)
            {
                try
                {
                    var taskbarObj = new TaskbarInstance();
                    _taskbarList = (ITaskbarList)taskbarObj;
                    _taskbarList.HrInit();
                }
                catch (Exception ex)
                {
                    Program.Log($"Failed to initialize ITaskbarList: {ex.Message}");
                }
            }
        }

        public void SetTaskbarVisibility(bool visible)
        {
            try
            {
                EnsureTaskbarList();
                if (visible)
                {
                    _taskbarList?.AddTab(this.Handle);
                    IntPtr style = GetWindowLongPtr(this.Handle, GWL_EXSTYLE);
                    long styleVal = style.ToInt64();
                    styleVal &= ~WS_EX_TOOLWINDOW;
                    styleVal |= WS_EX_APPWINDOW;
                    SetWindowLongPtr(this.Handle, GWL_EXSTYLE, new IntPtr(styleVal));
                }
                else
                {
                    _taskbarList?.DeleteTab(this.Handle);
                    IntPtr style = GetWindowLongPtr(this.Handle, GWL_EXSTYLE);
                    long styleVal = style.ToInt64();
                    styleVal |= WS_EX_TOOLWINDOW;
                    styleVal &= ~WS_EX_APPWINDOW;
                    SetWindowLongPtr(this.Handle, GWL_EXSTYLE, new IntPtr(styleVal));
                }
                SetWindowPos(this.Handle, IntPtr.Zero, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_FRAMECHANGED);
                Program.Log($"Taskbar visibility set to: {visible}");
            }
            catch (Exception ex)
            {
                Program.Log($"Error setting taskbar visibility: {ex.Message}");
            }
        }

        private void OnToggleTaskbar(object? sender, EventArgs e)
        {
            bool enabled = _taskbarItem?.Checked ?? false;
            _showInTaskbarEnabled = enabled;
            SetTaskbarVisibility(enabled);
            SaveTaskbarPreference(enabled);
            string msg = enabled ? "تم إظهار أيقونة اللوحة في شريط المهام" : "تم إخفاء أيقونة اللوحة من شريط المهام (Zero-Taskbar Mode)";
            _trayIcon?.ShowBalloonTip(3000, "شريط المهام", $"{msg} ⚡", ToolTipIcon.Info);
        }

        private void SetupIpcSignal()
        {
            RegisterIpcEvent(ref _showSignalEvent, ref _registeredShowWait, Program.ShowSignalEventName, async () =>
            {
                try
                {
                    Program.Log("Received IPC wake/show signal.");
                    this.Visible = true;
                    this.WindowState = FormWindowState.Normal;
                    IntPtr insertAfter = this.TopMost ? HWND_TOPMOST : HWND_NOTOPMOST;
                    SetWindowPos(this.Handle, insertAfter, this.Bounds.X, this.Bounds.Y, this.Bounds.Width, this.Bounds.Height, SWP_SHOWWINDOW);
                    this.BringToFront();
                    this.Activate();
                    await EnsureBackendReadyAsync();
                    try { _webView?.CoreWebView2?.Reload(); } catch { }
                    _trayIcon?.ShowBalloonTip(3000, "لوحة AIDA64 SensorPanel", $"تم تنشيط اللوحة وإظهارها ⚡ ({this.Bounds.Width}x{this.Bounds.Height})", ToolTipIcon.Info);
                }
                catch (Exception ex)
                {
                    Program.Log($"Error handling IPC show signal: {ex.Message}");
                }
            });

            RegisterIpcEvent(ref _primarySignalEvent, ref _registeredPrimaryWait, Program.PrimarySignalEventName, async () =>
            {
                try
                {
                    Program.Log("Received IPC primary display signal. Moving to primary screen...");
                    MoveToPrimaryDisplay();
                    await EnsureBackendReadyAsync();
                    try { _webView?.CoreWebView2?.Reload(); } catch { }
                }
                catch (Exception ex)
                {
                    Program.Log($"Error handling IPC primary signal: {ex.Message}");
                }
            });

            RegisterIpcEvent(ref _dedicatedSignalEvent, ref _registeredDedicatedWait, Program.DedicatedSignalEventName, async () =>
            {
                try
                {
                    Program.Log("Received IPC dedicated display signal. Moving to dedicated screen...");
                    MoveToDedicatedDisplay();
                    await EnsureBackendReadyAsync();
                    try { _webView?.CoreWebView2?.Reload(); } catch { }
                }
                catch (Exception ex)
                {
                    Program.Log($"Error handling IPC dedicated signal: {ex.Message}");
                }
            });

            RegisterIpcEvent(ref _toggleSignalEvent, ref _registeredToggleWait, Program.ToggleSignalEventName, async () =>
            {
                try
                {
                    Program.Log("Received IPC toggle signal.");
                    OnToggleVisibility(null, EventArgs.Empty);
                    if (this.Visible)
                    {
                        await EnsureBackendReadyAsync();
                        try { _webView?.CoreWebView2?.Reload(); } catch { }
                    }
                }
                catch (Exception ex)
                {
                    Program.Log($"Error handling IPC toggle signal: {ex.Message}");
                }
            });
        }

        private void RegisterIpcEvent(ref EventWaitHandle? evtHandle, ref RegisteredWaitHandle? regWait, string eventName, Action onSignaled)
        {
            try
            {
                evtHandle = new EventWaitHandle(false, EventResetMode.AutoReset, eventName);
                regWait = ThreadPool.RegisterWaitForSingleObject(evtHandle, (state, timedOut) =>
                {
                    if (timedOut) return;
                    if (this.IsDisposed || !this.IsHandleCreated) return;
                    try
                    {
                        this.BeginInvoke(onSignaled);
                    }
                    catch (Exception ex)
                    {
                        Program.Log($"Error executing IPC callback for {eventName}: {ex.Message}");
                    }
                }, null, Timeout.Infinite, false);
                Program.Log($"IPC signal listener registered for: {eventName}");
            }
            catch (Exception ex)
            {
                Program.Log($"Failed to setup IPC signal '{eventName}': {ex.Message}");
            }
        }

        protected override async void OnLoad(EventArgs e)
        {
            base.OnLoad(e);
            Program.Log("OnLoad triggered.");
            if (_startOnPrimary)
            {
                MoveToPrimaryDisplay();
            }
            else
            {
                PositionOnTargetDisplay();
            }
            this.Visible = true;
            this.BringToFront();

            if (_trayIcon != null)
            {
                _trayIcon.Visible = true;
                _trayIcon.ShowBalloonTip(3500, "لوحة AIDA64 SensorPanel", $"اللوحة قيد العمل الآن على الشاشة ({this.Bounds.Width}x{this.Bounds.Height}) وبجوار الساعة ⚡", ToolTipIcon.Info);
            }

            await InitializeWebViewAsync();
        }

        protected override void OnShown(EventArgs e)
        {
            base.OnShown(e);
            Program.Log("OnShown triggered.");
            this.Visible = true;
            this.WindowState = FormWindowState.Normal;
            IntPtr insertAfter = this.TopMost ? HWND_TOPMOST : HWND_NOTOPMOST;
            SetWindowPos(this.Handle, insertAfter, this.Bounds.X, this.Bounds.Y, this.Bounds.Width, this.Bounds.Height, SWP_SHOWWINDOW);
            this.BringToFront();
            SetTaskbarVisibility(_showInTaskbarEnabled);
        }

        protected override void WndProc(ref Message m)
        {
            // If explorer restarts, re-register tray icon
            if (_wmTaskbarCreated != 0 && m.Msg == _wmTaskbarCreated)
            {
                Program.Log("Explorer restarted: Re-registering tray icon.");
                if (_trayIcon != null)
                {
                    _trayIcon.Visible = false;
                    _trayIcon.Visible = true;
                }
            }
            base.WndProc(ref m);
        }

        private void PositionOnTargetDisplay()
        {
            var screens = Screen.AllScreens;
            Program.Log($"Detected {screens.Length} screens.");
            for (int i = 0; i < screens.Length; i++)
            {
                Program.Log($"Screen [{i}]: {screens[i].DeviceName} Bounds: {screens[i].Bounds} Primary: {screens[i].Primary}");
            }

            if (screens.Length == 0) return;

            int targetIdx = 0;
            for (int i = 0; i < screens.Length; i++)
            {
                var s = screens[i];
                if (s.Bounds.X >= 3840 && s.Bounds.Y < 0)
                {
                    targetIdx = i;
                    Program.Log($"Matched target Screen 2 (3840,-1200) at index {i}");
                    break;
                }
                if (!s.Primary)
                {
                    targetIdx = i;
                }
            }

            _currentScreenIndex = targetIdx;
            ApplyScreenBounds(screens[_currentScreenIndex]);
        }

        public void MoveToDedicatedDisplay()
        {
            var screens = Screen.AllScreens;
            for (int i = 0; i < screens.Length; i++)
            {
                if (screens[i].Bounds.X >= 3840 && screens[i].Bounds.Y < 0)
                {
                    _currentScreenIndex = i;
                    this.Visible = true;
                    this.WindowState = FormWindowState.Normal;
                    ApplyScreenBounds(screens[i]);
                    this.BringToFront();
                    _trayIcon?.ShowBalloonTip(3000, "تبديل الشاشة", $"تم نقل اللوحة إلى الشاشة المخصصة ({screens[i].Bounds.Width}x{screens[i].Bounds.Height}) ⚡", ToolTipIcon.Info);
                    return;
                }
            }
            OnSwitchScreen(null, EventArgs.Empty);
        }

        public void MoveToPrimaryDisplay()
        {
            var screens = Screen.AllScreens;
            for (int i = 0; i < screens.Length; i++)
            {
                if (screens[i].Primary)
                {
                    _currentScreenIndex = i;
                    this.Visible = true;
                    this.WindowState = FormWindowState.Normal;
                    ApplyScreenBounds(screens[i]);
                    this.BringToFront();
                    _trayIcon?.ShowBalloonTip(3000, "تبديل الشاشة", $"تم نقل اللوحة إلى الشاشة الرئيسية ({screens[i].Bounds.Width}x{screens[i].Bounds.Height}) ⚡", ToolTipIcon.Info);
                    return;
                }
            }
        }

        private void ApplyScreenBounds(Screen screen)
        {
            Program.Log($"Applying bounds for screen {screen.DeviceName}: {screen.Bounds}");
            this.Location = screen.Bounds.Location;
            this.Size = screen.Bounds.Size;
            this.Bounds = screen.Bounds;
            IntPtr insertAfter = this.TopMost ? HWND_TOPMOST : HWND_NOTOPMOST;
            SetWindowPos(this.Handle, insertAfter, screen.Bounds.X, screen.Bounds.Y, screen.Bounds.Width, screen.Bounds.Height, SWP_SHOWWINDOW);
        }

        private async Task EnsureBackendReadyAsync()
        {
            lock (_recoveryLock)
            {
                if (_isRecovering)
                {
                    Program.Log("EnsureBackendReadyAsync: Recovery already in progress, skipping duplicate call.");
                    return;
                }
                _isRecovering = true;
            }

            try
            {
                try
                {
                    var res = await _httpClient.GetAsync(HealthUrl);
                    if (res.IsSuccessStatusCode)
                    {
                        Program.Log("Backend is already running and healthy.");
                        return;
                    }
                }
                catch { }

                try
                {
                    if (_backendProcess != null && !_backendProcess.HasExited)
                    {
                        Program.Log($"Backend process PID {_backendProcess.Id} exists but did not respond to /health. Attempting to start/recover...");
                    }
                }
                catch { }

                try
                {
                    string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                    string backendDir = Path.GetFullPath(Path.Combine(baseDir, "..", "backend"));
                    if (!Directory.Exists(backendDir))
                    {
                        backendDir = @"D:\Services\aida64_suite\dashboard\backend";
                    }

                    string pythonExe = @"C:\Python314\pythonw.exe";
                    if (!File.Exists(pythonExe))
                    {
                        pythonExe = "pythonw";
                    }

                    Program.Log($"Launching backend using {pythonExe} from {backendDir}");
                    var psi = new ProcessStartInfo
                    {
                        FileName = pythonExe,
                        Arguments = "main.py",
                        WorkingDirectory = backendDir,
                        WindowStyle = ProcessWindowStyle.Hidden,
                        CreateNoWindow = true
                    };

                    var proc = Process.Start(psi);
                    if (proc != null)
                    {
                        _backendProcess = proc;
                        JobManager.Attach(proc);
                        Program.Log($"Backend launched with PID: {proc.Id} and attached to Job Object.");
                    }
                }
                catch (Exception ex)
                {
                    Program.Log($"Failed to launch backend: {ex.Message}");
                }

                // Wait up to 25 seconds for /health to respond
                for (int i = 0; i < 50; i++)
                {
                    await Task.Delay(500);
                    try
                    {
                        var res = await _httpClient.GetAsync(HealthUrl);
                        if (res.IsSuccessStatusCode)
                        {
                            Program.Log($"Backend reported healthy after {(i + 1) * 500}ms.");
                            return;
                        }
                    }
                    catch { }
                }
                Program.Log("Warning: Backend health check timed out after 25s.");
            }
            finally
            {
                lock (_recoveryLock)
                {
                    _isRecovering = false;
                }
            }
        }

        private void InitializeWatchdog()
        {
            if (_watchdogTimer != null) return;

            _watchdogTimer = new System.Windows.Forms.Timer
            {
                Interval = 15000 // 15 seconds
            };
            _watchdogTimer.Tick += async (s, e) =>
            {
                if (_isRecovering || this.IsDisposed || !this.IsHandleCreated) return;

                bool healthy = false;
                try
                {
                    var res = await _httpClient.GetAsync(HealthUrl);
                    healthy = res.IsSuccessStatusCode;
                }
                catch
                {
                    healthy = false;
                }

                if (!healthy)
                {
                    Program.Log("Watchdog: Backend health check failed. Triggering recovery...");
                    await EnsureBackendReadyAsync();
                    try
                    {
                        if (!this.IsDisposed && _webView?.CoreWebView2 != null)
                        {
                            _webView.CoreWebView2.Reload();
                            Program.Log("Watchdog: WebView2 reloaded successfully.");
                        }
                    }
                    catch (Exception ex)
                    {
                        Program.Log($"Watchdog: Failed to reload WebView2: {ex.Message}");
                    }
                }
            };
            _watchdogTimer.Start();
            Program.Log("Watchdog timer initialized and started (15s interval).");
        }

        private async Task InitializeWebViewAsync()
        {
            Program.Log("InitializeWebViewAsync starting...");
            string userDataDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "AIDA64_SensorPanel",
                "WebView2_Host_Cache"
            );

            var envOptions = new CoreWebView2EnvironmentOptions(
                additionalBrowserArguments: "--enable-gpu-rasterization --ignore-gpu-blocklist --disable-features=TranslateUI --disable-pinch"
            );

            try
            {
                Program.Log($"Creating CoreWebView2Environment at: {userDataDir}");
                var env = await CoreWebView2Environment.CreateAsync(null, userDataDir, envOptions);
                Program.Log("CoreWebView2Environment created. Ensuring CoreWebView2Async...");
                await _webView.EnsureCoreWebView2Async(env);
                Program.Log("CoreWebView2Async ensured successfully.");

                _webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
                _webView.CoreWebView2.Settings.IsStatusBarEnabled = false;
                _webView.CoreWebView2.Settings.AreDevToolsEnabled = true;

                _webView.NavigationCompleted += async (s, args) =>
                {
                    if (!args.IsSuccess)
                    {
                        Program.Log($"Navigation to {DashboardUrl} failed (WebErrorStatus: {args.WebErrorStatus}). Triggering backend check & retrying...");
                        await EnsureBackendReadyAsync();
                        if (!this.IsDisposed && _webView?.CoreWebView2 != null)
                        {
                            try { this.BeginInvoke(() => _webView.CoreWebView2.Navigate(DashboardUrl)); } catch { }
                        }
                    }
                    else
                    {
                        Program.Log("Dashboard loaded successfully in WebView2.");
                    }
                };

                await EnsureBackendReadyAsync();

                Program.Log($"Navigating to: {DashboardUrl}");
                _webView.CoreWebView2.Navigate(DashboardUrl);

                InitializeWatchdog();
            }
            catch (Exception ex)
            {
                Program.Log($"Error in InitializeWebViewAsync: {ex}");
                MessageBox.Show($"خطأ في تشغيل محرك WebView2:\n{ex.Message}", "خطأ في الواجهة", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private void OnSwitchScreen(object? sender, EventArgs e)
        {
            var screens = Screen.AllScreens;
            if (screens.Length <= 1) return;

            _currentScreenIndex = (_currentScreenIndex + 1) % screens.Length;
            Program.Log($"User requested Switch Screen -> Moving to index {_currentScreenIndex} ({screens[_currentScreenIndex].DeviceName})");
            ApplyScreenBounds(screens[_currentScreenIndex]);
        }

        private void OnToggleTopMost(object? sender, EventArgs e)
        {
            this.TopMost = _topmostItem?.Checked ?? false;
            Program.Log($"User toggled TopMost -> {this.TopMost}");
            IntPtr insertAfter = this.TopMost ? HWND_TOPMOST : HWND_NOTOPMOST;
            SetWindowPos(this.Handle, insertAfter, this.Bounds.X, this.Bounds.Y, this.Bounds.Width, this.Bounds.Height, SWP_SHOWWINDOW);
        }

        private void OnToggleVisibility(object? sender, EventArgs e)
        {
            this.Visible = !this.Visible;
            Program.Log($"User toggled Visibility -> {this.Visible}");
            if (this.Visible)
            {
                this.WindowState = FormWindowState.Normal;
                IntPtr insertAfter = this.TopMost ? HWND_TOPMOST : HWND_NOTOPMOST;
                SetWindowPos(this.Handle, insertAfter, this.Bounds.X, this.Bounds.Y, this.Bounds.Width, this.Bounds.Height, SWP_SHOWWINDOW);
                this.BringToFront();
            }
        }

        private async void OnRefreshDashboard(object? sender, EventArgs e)
        {
            Program.Log("User requested Reload.");
            try
            {
                await EnsureBackendReadyAsync();
                _webView?.CoreWebView2?.Reload();
            }
            catch (Exception ex)
            {
                Program.Log($"Error during OnRefreshDashboard: {ex.Message}");
            }
        }

        private bool IsAutoStartEnabled()
        {
            try
            {
                using var key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run", false);
                return key?.GetValue(AutoStartKeyName) != null;
            }
            catch { return false; }
        }

        private void OnToggleAutoStart(object? sender, EventArgs e)
        {
            try
            {
                using var key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run", true);
                if (key == null) return;

                if (_autoStartItem != null && _autoStartItem.Checked)
                {
                    string exePath = Application.ExecutablePath;
                    key.SetValue(AutoStartKeyName, $"\"{exePath}\"");
                    Program.Log("Auto-Start registered in Registry.");
                }
                else
                {
                    key.DeleteValue(AutoStartKeyName, false);
                    Program.Log("Auto-Start removed from Registry.");
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show($"تعذر ضبط الإقلاع التلقائي:\n{ex.Message}", "تنبيه", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
        }

        private void OnExitApplication(object? sender, EventArgs e)
        {
            Program.Log("User requested Exit Application.");
            _watchdogTimer?.Stop();
            if (_trayIcon != null)
            {
                _trayIcon.Visible = false;
                _trayIcon.Dispose();
            }
            try
            {
                if (_backendProcess != null && !_backendProcess.HasExited)
                {
                    _backendProcess.Kill();
                }
            }
            catch { }
            Application.Exit();
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                if (_watchdogTimer != null)
                {
                    _watchdogTimer.Stop();
                    _watchdogTimer.Dispose();
                    _watchdogTimer = null;
                }

                _registeredShowWait?.Unregister(null);
                _showSignalEvent?.Dispose();

                _registeredPrimaryWait?.Unregister(null);
                _primarySignalEvent?.Dispose();

                _registeredDedicatedWait?.Unregister(null);
                _dedicatedSignalEvent?.Dispose();

                _registeredToggleWait?.Unregister(null);
                _toggleSignalEvent?.Dispose();

                _trayIcon?.Dispose();
                _trayMenu?.Dispose();
                _webView?.Dispose();
            }
            base.Dispose(disposing);
        }
    }
}
