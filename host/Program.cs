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

    public class DashboardHostForm : Form
    {
        private WebView2 _webView = null!;
        private NotifyIcon? _trayIcon;
        private ContextMenuStrip? _trayMenu;
        private ToolStripMenuItem? _topmostItem;
        private ToolStripMenuItem? _autoStartItem;
        private int _currentScreenIndex = 0;
        private bool _startOnPrimary = false;
        private const string DashboardUrl = "http://localhost:8088";
        private const string AutoStartKeyName = "AIDA64WebSensorPanel";

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
            RegisterIpcEvent(ref _showSignalEvent, ref _registeredShowWait, Program.ShowSignalEventName, () =>
            {
                Program.Log("Received IPC wake/show signal.");
                this.Visible = true;
                this.WindowState = FormWindowState.Normal;
                IntPtr insertAfter = this.TopMost ? HWND_TOPMOST : HWND_NOTOPMOST;
                SetWindowPos(this.Handle, insertAfter, this.Bounds.X, this.Bounds.Y, this.Bounds.Width, this.Bounds.Height, SWP_SHOWWINDOW);
                this.BringToFront();
                this.Activate();
                try { _webView?.CoreWebView2?.Reload(); } catch { }
                _trayIcon?.ShowBalloonTip(3000, "لوحة AIDA64 SensorPanel", $"تم تنشيط اللوحة وإظهارها ⚡ ({this.Bounds.Width}x{this.Bounds.Height})", ToolTipIcon.Info);
            });

            RegisterIpcEvent(ref _primarySignalEvent, ref _registeredPrimaryWait, Program.PrimarySignalEventName, () =>
            {
                Program.Log("Received IPC primary display signal. Moving to primary screen...");
                MoveToPrimaryDisplay();
                try { _webView?.CoreWebView2?.Reload(); } catch { }
            });

            RegisterIpcEvent(ref _dedicatedSignalEvent, ref _registeredDedicatedWait, Program.DedicatedSignalEventName, () =>
            {
                Program.Log("Received IPC dedicated display signal. Moving to dedicated screen...");
                MoveToDedicatedDisplay();
                try { _webView?.CoreWebView2?.Reload(); } catch { }
            });

            RegisterIpcEvent(ref _toggleSignalEvent, ref _registeredToggleWait, Program.ToggleSignalEventName, () =>
            {
                Program.Log("Received IPC toggle signal.");
                OnToggleVisibility(null, EventArgs.Empty);
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
            using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(1) };

            try
            {
                var res = await client.GetAsync("http://localhost:8088/health");
                if (res.IsSuccessStatusCode)
                {
                    Program.Log("Backend is already running and healthy.");
                    return;
                }
            }
            catch { }

            try
            {
                string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                string backendDir = Path.GetFullPath(Path.Combine(baseDir, "..", "backend"));
                if (!Directory.Exists(backendDir))
                {
                    backendDir = @"D:\Services\aida64_dashboard\backend";
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
                Process.Start(psi);
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
                    var res = await client.GetAsync("http://localhost:8088/health");
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

                _webView.NavigationCompleted += (s, args) =>
                {
                    if (!args.IsSuccess)
                    {
                        Program.Log($"Navigation to {DashboardUrl} failed (WebErrorStatus: {args.WebErrorStatus}). Retrying in 2 seconds...");
                        Task.Delay(2000).ContinueWith(_ =>
                        {
                            if (!this.IsDisposed && _webView?.CoreWebView2 != null)
                            {
                                try { this.BeginInvoke(() => _webView.CoreWebView2.Navigate(DashboardUrl)); } catch { }
                            }
                        });
                    }
                    else
                    {
                        Program.Log("Dashboard loaded successfully in WebView2.");
                    }
                };

                await EnsureBackendReadyAsync();

                Program.Log($"Navigating to: {DashboardUrl}");
                _webView.CoreWebView2.Navigate(DashboardUrl);
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

        private void OnRefreshDashboard(object? sender, EventArgs e)
        {
            Program.Log("User requested Reload.");
            _webView?.CoreWebView2?.Reload();
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
            if (_trayIcon != null)
            {
                _trayIcon.Visible = false;
                _trayIcon.Dispose();
            }
            Application.Exit();
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
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
