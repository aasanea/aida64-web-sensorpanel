using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Net.Http;
using System.Runtime.InteropServices;
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

        public static void Log(string msg)
        {
            try
            {
                File.AppendAllText(LogFile, $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff}] {msg}\r\n");
            }
            catch { }
        }

        [STAThread]
        static void Main()
        {
            Log("AIDA64Panel starting...");

            using var mutex = new System.Threading.Mutex(true, "AIDA64_SensorPanel_Host_Mutex", out bool createdNew);
            if (!createdNew)
            {
                Log("Mutex already held by existing instance.");
                MessageBox.Show("لوحة AIDA64 SensorPanel تعمل بالفعل في صينية النظام بجوار الساعة.\nيمكنك النقر بزر الفأرة الأيمن على الأيقونة للتحكم بها أو تبديل الشاشة.", "تنبيه", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }

            try
            {
                ApplicationConfiguration.Initialize();
                Log("ApplicationConfiguration initialized.");
                Application.Run(new DashboardHostForm());
            }
            catch (Exception ex)
            {
                Log($"Fatal Exception in Main: {ex}");
                MessageBox.Show($"خطأ أثناء تشغيل اللوحة:\n{ex.Message}", "خطأ فادح", MessageBoxButtons.OK, MessageBoxIcon.Error);
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

        public DashboardHostForm()
        {
            Program.Log("DashboardHostForm constructor called.");
            InitializeWindow();
            InitializeTray();
            EnsureBackendRunning();
        }

        protected override CreateParams CreateParams
        {
            get
            {
                CreateParams cp = base.CreateParams;
                cp.ExStyle |= 0x00000080; // WS_EX_TOOLWINDOW
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

        protected override async void OnLoad(EventArgs e)
        {
            base.OnLoad(e);
            Program.Log("OnLoad triggered.");
            PositionOnTargetDisplay();
            this.Visible = true;
            this.BringToFront();

            await InitializeWebViewAsync();
        }

        protected override void OnShown(EventArgs e)
        {
            base.OnShown(e);
            Program.Log("OnShown triggered.");
            this.Visible = true;
            this.WindowState = FormWindowState.Normal;
            this.BringToFront();
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

        private void ApplyScreenBounds(Screen screen)
        {
            Program.Log($"Applying bounds for screen {screen.DeviceName}: {screen.Bounds}");
            this.Location = screen.Bounds.Location;
            this.Size = screen.Bounds.Size;
            this.Bounds = screen.Bounds;
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

        private Icon CreateDynamicTrayIcon()
        {
            using var bmp = new Bitmap(32, 32);
            using (var g = Graphics.FromImage(bmp))
            {
                g.SmoothingMode = SmoothingMode.AntiAlias;
                using var bgBrush = new SolidBrush(Color.FromArgb(15, 23, 42));
                g.FillEllipse(bgBrush, 1, 1, 30, 30);

                using var pen = new Pen(Color.FromArgb(34, 211, 238), 2.5f);
                g.DrawEllipse(pen, 2, 2, 28, 28);

                using var boltBrush = new SolidBrush(Color.FromArgb(245, 158, 11));
                Point[] bolt = new Point[]
                {
                    new Point(18, 5),
                    new Point(9, 17),
                    new Point(15, 17),
                    new Point(13, 27),
                    new Point(23, 14),
                    new Point(17, 14)
                };
                g.FillPolygon(boltBrush, bolt);
            }
            return Icon.FromHandle(bmp.GetHicon());
        }

        private void InitializeTray()
        {
            _trayMenu = new ContextMenuStrip();
            _trayMenu.RightToLeft = RightToLeft.Yes;

            var switchItem = new ToolStripMenuItem("🖥️ تبديل الشاشة (Switch Display)", null, OnSwitchScreen);
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

            _trayMenu.Items.Add(switchItem);
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
                Icon = CreateDynamicTrayIcon(),
                ContextMenuStrip = _trayMenu,
                Visible = true
            };

            _trayIcon.DoubleClick += (s, e) => OnToggleVisibility(s, e);
            Program.Log("Tray icon initialized successfully.");
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
        }

        private void OnToggleVisibility(object? sender, EventArgs e)
        {
            this.Visible = !this.Visible;
            Program.Log($"User toggled Visibility -> {this.Visible}");
            if (this.Visible)
            {
                this.WindowState = FormWindowState.Normal;
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
                _trayIcon?.Dispose();
                _trayMenu?.Dispose();
                _webView?.Dispose();
            }
            base.Dispose(disposing);
        }
    }
}
