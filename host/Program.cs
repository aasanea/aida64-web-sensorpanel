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
        [STAThread]
        static void Main()
        {
            // Only allow single instance of Host
            using var mutex = new System.Threading.Mutex(true, "AIDA64_SensorPanel_Host_Mutex", out bool createdNew);
            if (!createdNew)
            {
                MessageBox.Show("لوحة AIDA64 SensorPanel تعمل بالفعل في صينية النظام بجوار الساعة.", "تنبيه", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }

            ApplicationConfiguration.Initialize();
            Application.Run(new DashboardHostForm());
        }
    }

    public class DashboardHostForm : Form
    {
        private WebView2? _webView;
        private NotifyIcon? _trayIcon;
        private ContextMenuStrip? _trayMenu;
        private ToolStripMenuItem? _topmostItem;
        private ToolStripMenuItem? _autoStartItem;
        private int _currentScreenIndex = 0;
        private const string DashboardUrl = "http://localhost:8088";
        private const string AutoStartKeyName = "AIDA64WebSensorPanel";

        public DashboardHostForm()
        {
            InitializeWindow();
            InitializeTray();
            EnsureBackendRunning();
            _ = InitializeWebViewAsync();
        }

        private void InitializeWindow()
        {
            this.Text = "AIDA64 SensorPanel Host";
            this.FormBorderStyle = FormBorderStyle.None;
            this.ShowInTaskbar = false;
            this.StartPosition = FormStartPosition.Manual;
            this.TopMost = false;
            this.BackColor = Color.FromArgb(10, 15, 30);

            PositionOnTargetDisplay();
        }

        private void PositionOnTargetDisplay()
        {
            var screens = Screen.AllScreens;
            if (screens.Length == 0) return;

            int targetIdx = 0;
            for (int i = 0; i < screens.Length; i++)
            {
                var s = screens[i];
                if (!s.Primary)
                {
                    // Prioritize Screen 2 (3840, -1200 or right/top secondary screen)
                    if (s.Bounds.X >= 3840 && s.Bounds.Y < 0)
                    {
                        targetIdx = i;
                        break;
                    }
                    targetIdx = i;
                }
            }

            _currentScreenIndex = targetIdx;
            ApplyScreenBounds(screens[_currentScreenIndex]);
        }

        private void ApplyScreenBounds(Screen screen)
        {
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
                    if (res.IsSuccessStatusCode) return;
                }
                catch { }

                // Launch backend if not responsive
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
                catch { }
            });
        }

        private async Task InitializeWebViewAsync()
        {
            _webView = new WebView2
            {
                Dock = DockStyle.Fill
            };
            this.Controls.Add(_webView);

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
                var env = await CoreWebView2Environment.CreateAsync(null, userDataDir, envOptions);
                await _webView.EnsureCoreWebView2Async(env);

                _webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
                _webView.CoreWebView2.Settings.IsStatusBarEnabled = false;
                _webView.CoreWebView2.Settings.AreDevToolsEnabled = true;

                _webView.CoreWebView2.Navigate(DashboardUrl);
            }
            catch (Exception ex)
            {
                MessageBox.Show($"خطأ في تشغيل محرك WebView2:\n{ex.Message}", "خطأ في الواجهة", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private Icon CreateDynamicTrayIcon()
        {
            using var bmp = new Bitmap(32, 32);
            using (var g = Graphics.FromImage(bmp))
            {
                g.SmoothingMode = SmoothingMode.AntiAlias;
                // Dark background pill
                using var bgBrush = new SolidBrush(Color.FromArgb(15, 23, 42));
                g.FillEllipse(bgBrush, 1, 1, 30, 30);

                // Neon cyan border
                using var pen = new Pen(Color.FromArgb(34, 211, 238), 2.5f);
                g.DrawEllipse(pen, 2, 2, 28, 28);

                // Lightning bolt / HUD symbol
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
        }

        private void OnSwitchScreen(object? sender, EventArgs e)
        {
            var screens = Screen.AllScreens;
            if (screens.Length <= 1) return;

            _currentScreenIndex = (_currentScreenIndex + 1) % screens.Length;
            ApplyScreenBounds(screens[_currentScreenIndex]);
        }

        private void OnToggleTopMost(object? sender, EventArgs e)
        {
            this.TopMost = _topmostItem?.Checked ?? false;
        }

        private void OnToggleVisibility(object? sender, EventArgs e)
        {
            this.Visible = !this.Visible;
            if (this.Visible)
            {
                this.WindowState = FormWindowState.Normal;
                this.BringToFront();
            }
        }

        private void OnRefreshDashboard(object? sender, EventArgs e)
        {
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
                }
                else
                {
                    key.DeleteValue(AutoStartKeyName, false);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show($"تعذر ضبط الإقلاع التلقائي:\n{ex.Message}", "تنبيه", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
        }

        private void OnExitApplication(object? sender, EventArgs e)
        {
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
