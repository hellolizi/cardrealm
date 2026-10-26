using System.Diagnostics;
using System.Drawing;
using System.Globalization;
using System.Reflection;
using System.Runtime.InteropServices;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace CardRealm;

public sealed class MainForm : Form
{
    private const string VirtualHost = "cardrealm.local";
    private const string StartUrl = "http://" + VirtualHost + "/index.html";

    private readonly WebView2 _webView = new();
    private bool _fullscreen;
    private Rectangle _restoreBounds;
    private FormBorderStyle _restoreBorder = FormBorderStyle.Sizable;
    private FormWindowState _restoreState = FormWindowState.Normal;

    public MainForm()
    {
        Text = "牌境 · The Card Realm";
        BackColor = Color.FromArgb(13, 10, 16);
        StartPosition = FormStartPosition.CenterScreen;
        AutoScaleMode = AutoScaleMode.Dpi;

        var work = Screen.PrimaryScreen?.WorkingArea ?? new Rectangle(0, 0, 1440, 900);
        Size = new Size(Math.Min(1460, work.Width - 80), Math.Min(920, work.Height - 80));
        MinimumSize = new Size(Math.Min(1120, work.Width), Math.Min(700, work.Height));

        try
        {
            Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        }
        catch
        {
            // The embedded executable icon is optional.
        }

        _webView.Dock = DockStyle.Fill;
        _webView.DefaultBackgroundColor = Color.FromArgb(13, 10, 16);
        Controls.Add(_webView);
        Load += OnLoad;
        FormClosed += (_, _) => _webView.Dispose();
    }

    private async void OnLoad(object? sender, EventArgs e)
    {
        try
        {
            var webRoot = Path.Combine(AppContext.BaseDirectory, "wwwroot");
            if (!File.Exists(Path.Combine(webRoot, "index.html")))
            {
                ShowFatal("找不到游戏资源目录 wwwroot。请完整解压应用文件夹后再启动。");
                return;
            }

            var userDataFolder = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "CardRealm",
                "WebView2");
            Directory.CreateDirectory(userDataFolder);

            var environment = await CoreWebView2Environment.CreateAsync(null, userDataFolder);
            await _webView.EnsureCoreWebView2Async(environment);
            var core = _webView.CoreWebView2;

            core.Settings.AreDefaultContextMenusEnabled = false;
            core.Settings.IsStatusBarEnabled = false;
            core.Settings.IsSwipeNavigationEnabled = false;
            core.Settings.IsGeneralAutofillEnabled = false;
            core.Settings.IsPasswordAutosaveEnabled = false;
            core.Settings.IsZoomControlEnabled = true;
#if DEBUG
            core.Settings.AreDevToolsEnabled = true;
#else
            core.Settings.AreDevToolsEnabled = false;
#endif

            core.SetVirtualHostNameToFolderMapping(
                VirtualHost,
                webRoot,
                CoreWebView2HostResourceAccessKind.Allow);

            core.NavigationStarting += (_, args) =>
            {
                if (IsAppUrl(args.Uri)) return;
                args.Cancel = true;
                OpenExternal(args.Uri);
            };
            core.NewWindowRequested += (_, args) =>
            {
                args.Handled = true;
                OpenExternal(args.Uri);
            };
            core.PermissionRequested += (_, args) =>
            {
                args.State = args.PermissionKind == CoreWebView2PermissionKind.ClipboardRead
                    ? CoreWebView2PermissionState.Allow
                    : CoreWebView2PermissionState.Deny;
            };
            await core.AddScriptToExecuteOnDocumentCreatedAsync(
                "window.addEventListener('keydown',e=>{"
                + "if(e.key==='F11'){e.preventDefault();window.chrome.webview.postMessage('toggle-fullscreen');}"
                + "},true);");
            core.WebMessageReceived += (_, args) =>
            {
                var message = args.TryGetWebMessageAsString();
                if (message == "toggle-fullscreen")
                {
                    ToggleFullscreen();
                    return;
                }
                if (message is not null
                    && message.StartsWith("set-zoom:", StringComparison.Ordinal)
                    && double.TryParse(message.AsSpan(9), NumberStyles.Float, CultureInfo.InvariantCulture, out var zoom))
                {
                    _webView.ZoomFactor = Math.Clamp(zoom, 0.5, 2.5);
                }
            };
            core.DownloadStarting += (_, args) =>
            {
                using var dialog = new SaveFileDialog
                {
                    Title = "保存牌境存档",
                    Filter = "牌境存档 (*.json)|*.json|所有文件 (*.*)|*.*",
                    FileName = string.IsNullOrWhiteSpace(args.ResultFilePath)
                        ? $"cardrealm-backup-{DateTime.Now:yyyy-MM-dd}.json"
                        : Path.GetFileName(args.ResultFilePath),
                    DefaultExt = "json",
                    AddExtension = true,
                    OverwritePrompt = true,
                };
                if (dialog.ShowDialog(this) != DialogResult.OK)
                {
                    args.Cancel = true;
                    return;
                }
                args.ResultFilePath = dialog.FileName;
                args.Handled = true;
            };
            core.ProcessFailed += (_, args) =>
            {
                if (args.ProcessFailedKind == CoreWebView2ProcessFailedKind.BrowserProcessExited)
                {
                    ShowFatal("梦境被系统中断了。请重新打开牌境。");
                }
            };

            try
            {
                await core.Profile.ClearBrowsingDataAsync(CoreWebView2BrowsingDataKinds.DiskCache);
            }
            catch
            {
                // Cache cleanup is best-effort; the game still runs without it.
            }

            var version = Assembly.GetExecutingAssembly().GetName().Version?.ToString(3) ?? "0";
            core.Navigate($"{StartUrl}?v={version}");
        }
        catch (WebView2RuntimeNotFoundException)
        {
            ShowFatal(
                "未检测到 Microsoft Edge WebView2 运行时。\n\n"
                + "请安装 WebView2 Runtime 后重新打开牌境：\n"
                + "https://developer.microsoft.com/microsoft-edge/webview2/");
        }
        catch (Exception error)
        {
            ShowFatal($"牌境启动失败：\n{error.Message}");
        }
    }

    private static bool IsAppUrl(string uri)
    {
        return Uri.TryCreate(uri, UriKind.Absolute, out var parsed)
            && parsed.Scheme == Uri.UriSchemeHttp
            && parsed.Host.Equals(VirtualHost, StringComparison.OrdinalIgnoreCase);
    }

    private static void OpenExternal(string uri)
    {
        if (!Uri.TryCreate(uri, UriKind.Absolute, out var parsed)) return;
        if (parsed.Scheme != Uri.UriSchemeHttp
            && parsed.Scheme != Uri.UriSchemeHttps
            && parsed.Scheme != Uri.UriSchemeMailto) return;
        try
        {
            Process.Start(new ProcessStartInfo(parsed.AbsoluteUri) { UseShellExecute = true });
        }
        catch
        {
            // 系统没有默认浏览器或邮件客户端时静默失败，不打断游戏
        }
    }

    private void ToggleFullscreen()
    {
        if (!_fullscreen)
        {
            _restoreBounds = Bounds;
            _restoreBorder = FormBorderStyle;
            _restoreState = WindowState;
            FormBorderStyle = FormBorderStyle.None;
            WindowState = FormWindowState.Maximized;
            _fullscreen = true;
            return;
        }

        _fullscreen = false;
        FormBorderStyle = _restoreBorder;
        WindowState = _restoreState;
        Bounds = _restoreBounds;
    }

    private void ShowFatal(string message)
    {
        MessageBox.Show(this, message, "牌境", MessageBoxButtons.OK, MessageBoxIcon.Error);
        Close();
    }

    protected override void OnHandleCreated(EventArgs e)
    {
        base.OnHandleCreated(e);
        ApplyDarkTitleBar();
    }

    private void ApplyDarkTitleBar()
    {
        if (!OperatingSystem.IsWindowsVersionAtLeast(10, 0, 17763)) return;
        var enabled = 1;
        try
        {
            if (DwmSetWindowAttribute(Handle, 20, ref enabled, sizeof(int)) != 0)
            {
                DwmSetWindowAttribute(Handle, 19, ref enabled, sizeof(int));
            }
        }
        catch
        {
            // Older Windows builds keep the default title bar.
        }
    }

    [DllImport("dwmapi.dll")]
    private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attribute, ref int value, int size);
}
