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
        private const string MutexName = "AIDA64_SensorPanel_Host_Mutex";
        private const string SignalEventName = "AIDA64_SensorPanel_Show_Signal";

        public static void Log(string msg)
        {
            try
            {
                File.AppendAllText(LogFile, $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff}] {msg}\r\n");
            }
            catch { }
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
                Log("Existing instance detected. Signaling activation...");
                try
                {
                    if (EventWaitHandle.TryOpenExisting(SignalEventName, out var signalHandle))
                    {
                        signalHandle.Set();
                        Log("Signal sent to running instance. Exiting secondary process.");
                        return;
                    }
                }
                catch (Exception ex)
                {
                    Log($"Failed to open signal handle: {ex.Message}");
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
        private const string DashboardUrl = "http://localhost:8088";
        private const string AutoStartKeyName = "AIDA64WebSensorPanel";
        private const string SignalEventName = "AIDA64_SensorPanel_Show_Signal";
        private EventWaitHandle? _showSignalEvent;
        private RegisteredWaitHandle? _registeredWait;

        private static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);
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

            InitializeWindow();
            InitializeTray();
            SetupIpcSignal();
            EnsureBackendRunning();

            if (args != null && args.Length > 0)
            {
                foreach (var arg in args)
                {
                    if (arg.Equals("--primary", StringComparison.OrdinalIgnoreCase))
                    {
                        MoveToPrimaryDisplay();
                    }
                }
            }
        }

        protected override CreateParams CreateParams
        {
            get
            {
                CreateParams cp = base.CreateParams;
                cp.ExStyle |= 0x00000080; // WS_EX_TOOLWINDOW (Eliminates taskbar button)
                cp.ExStyle &= ~0x00040000; // Strip WS_EX_APPWINDOW
                return cp;
            }
        }

        private void InitializeWindow()
        {
            this.Text = "AIDA64 SensorPanel Host";
            this.FormBorderStyle = FormBorderStyle.None;
            this.ShowInTaskbar = false;
            this.StartPosition = FormStartPosition.Manual;
            this.TopMost = true;
            this.BackColor = Color.FromArgb(10, 15, 30);

            _webView = new WebView2
            {
                Dock = DockStyle.Fill
            };
            this.Controls.Add(_webView);

            PositionOnTargetDisplay();
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

        private void SetupIpcSignal()
        {
            try
            {
                _showSignalEvent = new EventWaitHandle(false, EventResetMode.AutoReset, SignalEventName);
                _registeredWait = ThreadPool.RegisterWaitForSingleObject(_showSignalEvent, (state, timedOut) =>
                {
                    this.BeginInvoke(() =>
                    {
                        Program.Log("Received IPC wake/show signal.");
                        this.Visible = true;
                        this.WindowState = FormWindowState.Normal;
                        SetWindowPos(this.Handle, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW);
                        this.BringToFront();
                        _trayIcon?.ShowBalloonTip(3000, "لوحة AIDA64 SensorPanel", "تم تنشيط اللوحة وإظهارها في المقدمة ⚡", ToolTipIcon.Info);
                    });
                }, null, Timeout.Infinite, false);
            }
            catch (Exception ex)
            {
                Program.Log($"Failed to setup IPC signal: {ex.Message}");
            }
        }

        protected override async void OnLoad(EventArgs e)
        {
            base.OnLoad(e);
            Program.Log("OnLoad triggered.");
            PositionOnTargetDisplay();
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
            SetWindowPos(this.Handle, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW);
            this.BringToFront();
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
                    ApplyScreenBounds(screens[i]);
                    _trayIcon?.ShowBalloonTip(3000, "تبديل الشاشة", $"تم نقل اللوحة إلى الشاشة المخصصة ({screens[i].Bounds.Width}x{screens[i].Bounds.Height})", ToolTipIcon.Info);
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
                    ApplyScreenBounds(screens[i]);
                    _trayIcon?.ShowBalloonTip(3000, "تبديل الشاشة", $"تم نقل اللوحة إلى الشاشة الرئيسية ({screens[i].Bounds.Width}x{screens[i].Bounds.Height})", ToolTipIcon.Info);
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
            SetWindowPos(this.Handle, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW);
        }

        private void EnsureBackendRunning()
        {
            Task.Run(async () =>
            {
                try
                {
                    using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(2) };
                    var res = await client.GetAsync("http://localhost:8088/health");
                    if (res.IsSuccessStatusCode)
                    {
                        Program.Log("Backend is already running.");
                        return;
                    }
                }
                catch { }

                try
                {
                    string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                    string projectRoot = Path.GetFullPath(Path.Combine(baseDir, @"..\..\..\..\"));
                    string backendDir = Path.Combine(projectRoot, "backend");
                    if (!Directory.Exists(backendDir))
                    {
                        backendDir = @"D:\Services\aida64_dashboard\backend";
                    }

                    if (Directory.Exists(backendDir))
                    {
                        Program.Log($"Launching backend from {backendDir}");
                        var psi = new ProcessStartInfo
                        {
                            FileName = "pythonw",
                            Arguments = "-m uvicorn main:app --host 0.0.0.0 --port 8088",
                            WorkingDirectory = backendDir,
                            WindowStyle = ProcessWindowStyle.Hidden,
                            CreateNoWindow = true
                        };
                        Process.Start(psi);
                    }
                }
                catch (Exception ex)
                {
                    Program.Log($"Failed to launch backend: {ex.Message}");
                }
            });
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
            if (this.TopMost)
            {
                SetWindowPos(this.Handle, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW);
            }
        }

        private void OnToggleVisibility(object? sender, EventArgs e)
        {
            this.Visible = !this.Visible;
            Program.Log($"User toggled Visibility -> {this.Visible}");
            if (this.Visible)
            {
                this.WindowState = FormWindowState.Normal;
                SetWindowPos(this.Handle, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW);
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
                _registeredWait?.Unregister(null);
                _showSignalEvent?.Dispose();
                _trayIcon?.Dispose();
                _trayMenu?.Dispose();
                _webView?.Dispose();
            }
            base.Dispose(disposing);
        }
    }
}
