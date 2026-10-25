//! Hold-to-preview in File Explorer and on the desktop (Windows only).
//!
//! A small helper process (`platinum-reader --peek-helper`) installs a low-level mouse
//! hook. When the left button is held still for 3 s over Explorer or the desktop, it asks
//! Explorer (Shell COM API) which file was pressed and shows a pre-loaded "peek" window
//! with that file's first page. Releasing the button hides it.

pub const HELPER_ARG: &str = "--peek-helper";
pub const SUPPORTED: &[&str] = &[
    "pdf", "epub", "mobi", "azw", "azw3", "fb2", "cbz", "cbr", "djvu", "djv", "xps", "oxps", "md", "markdown", "chm",
];

#[cfg(windows)]
pub use win::{run_helper, set_enabled};

#[cfg(not(windows))]
pub fn set_enabled(_enabled: bool) {}
#[cfg(not(windows))]
pub fn run_helper() {}

#[cfg(windows)]
mod win {
    use super::{HELPER_ARG, SUPPORTED};
    use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
    use std::sync::{Mutex, OnceLock};
    use std::time::Duration;
    use tauri::{AppHandle, Emitter, Manager};
    use windows::core::{w, Interface, BSTR, PCWSTR};
    use windows::Win32::Foundation::*;
    use windows::Win32::System::Com::*;
    use windows::Win32::System::LibraryLoader::GetModuleHandleW;
    use windows::Win32::System::Registry::*;
    use windows::Win32::System::Threading::CreateMutexW;
    use windows::Win32::System::Variant::VARIANT;
    use windows::Win32::UI::Shell::*;
    use windows::Win32::UI::WindowsAndMessaging::*;

    const HOLD: Duration = Duration::from_millis(3000);
    const RUN_KEY: PCWSTR = w!("Software\\Microsoft\\Windows\\CurrentVersion\\Run");
    const RUN_VALUE: PCWSTR = w!("PlatinumReaderPeek");

    static APP: OnceLock<AppHandle> = OnceLock::new();
    /// Bumped on every press/release/move-cancel; a pending hold only fires if it is unchanged.
    static GEN: AtomicU64 = AtomicU64::new(0);
    static DOWN: Mutex<Option<POINT>> = Mutex::new(None);
    static SHOWING: AtomicBool = AtomicBool::new(false);

    /// Diagnostics: create %TEMP%\platinum-peek.debug to get a log next to it.
    fn log(msg: impl AsRef<str>) {
        let dir = std::env::temp_dir();
        if dir.join("platinum-peek.debug").exists() {
            use std::io::Write;
            if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(dir.join("platinum-peek.log")) {
                let _ = writeln!(f, "{}", msg.as_ref());
            }
        }
    }

    // ---------- enable / disable (called by the main app) ----------

    /// Adds or removes the helper from Windows startup, and starts it now if enabled.
    pub fn set_enabled(enabled: bool) {
        let exe = std::env::current_exe().unwrap_or_default();
        unsafe {
            if enabled {
                let cmd: Vec<u16> = format!("\"{}\" {HELPER_ARG}\0", exe.display()).encode_utf16().collect();
                let bytes = std::slice::from_raw_parts(cmd.as_ptr() as *const u8, cmd.len() * 2);
                let _ = RegSetKeyValueW(HKEY_CURRENT_USER, RUN_KEY, RUN_VALUE, REG_SZ.0, Some(bytes.as_ptr() as _), bytes.len() as u32);
            } else {
                let _ = RegDeleteKeyValueW(HKEY_CURRENT_USER, RUN_KEY, RUN_VALUE);
            }
        }
        // The helper refuses to run twice (named mutex), so spawning when it's already up is harmless.
        if enabled {
            use std::os::windows::process::CommandExt;
            let _ = std::process::Command::new(exe).arg(HELPER_ARG).creation_flags(0x0800_0000).spawn();
        }
    }

    fn still_enabled() -> bool {
        unsafe { RegGetValueW(HKEY_CURRENT_USER, RUN_KEY, RUN_VALUE, RRF_RT_REG_SZ, None, None, None).is_ok() }
    }

    // ---------- helper process ----------

    pub fn run_helper() {
        unsafe {
            let _guard = CreateMutexW(None, true, w!("Local\\PlatinumReaderPeekHelper"));
            if GetLastError() == ERROR_ALREADY_EXISTS || !still_enabled() {
                return;
            }
        }
        tauri::Builder::default()
            // The preview window reads files through the same commands as the main app.
            .invoke_handler(tauri::generate_handler![crate::read_file, crate::extract_chm, peek_log])
            .setup(|app| {
                let _ = APP.set(app.handle().clone());
                tauri::WebviewWindowBuilder::new(app, "peek", tauri::WebviewUrl::App("index.html?peek=1".into()))
                    .title("Platinum Reader preview")
                    .decorations(false)
                    .transparent(true)
                    .shadow(false)
                    .always_on_top(true)
                    .skip_taskbar(true)
                    .focused(false)
                    .resizable(false)
                    .visible(false)
                    .inner_size(320.0, 460.0)
                    .build()?;
                std::thread::spawn(hook_thread);
                // Turning the feature off in Settings removes the startup entry; then we quit.
                let handle = app.handle().clone();
                std::thread::spawn(move || loop {
                    std::thread::sleep(Duration::from_secs(5));
                    if !still_enabled() {
                        handle.exit(0);
                    }
                });
                Ok(())
            })
            .run(tauri::generate_context!())
            .expect("peek helper failed");
    }

    /// Lets the preview window report problems into the diagnostic log.
    #[tauri::command]
    fn peek_log(msg: String) {
        log(format!("window: {msg}"));
    }

    fn hook_thread() {
        unsafe {
            let module = GetModuleHandleW(None).unwrap_or_default();
            let Ok(_hook) = SetWindowsHookExW(WH_MOUSE_LL, Some(mouse_hook), Some(module.into()), 0) else { log("hook failed"); return };
            log("hook installed");
            let mut msg = MSG::default();
            while GetMessageW(&mut msg, None, 0, 0).as_bool() {}
        }
    }

    unsafe extern "system" fn mouse_hook(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
        if code >= 0 {
            let pt = (*(lparam.0 as *const MSLLHOOKSTRUCT)).pt;
            match wparam.0 as u32 {
                WM_LBUTTONDOWN => {
                    let gen = GEN.fetch_add(1, Ordering::SeqCst) + 1;
                    *DOWN.lock().unwrap() = Some(pt);
                    std::thread::spawn(move || {
                        std::thread::sleep(HOLD);
                        if GEN.load(Ordering::SeqCst) == gen {
                            on_hold(pt);
                        }
                    });
                }
                WM_MOUSEMOVE => {
                    let mut down = DOWN.lock().unwrap();
                    if let Some(start) = *down {
                        let (dx, dy) = ((pt.x - start.x).abs(), (pt.y - start.y).abs());
                        if dx > GetSystemMetrics(SM_CXDRAG) || dy > GetSystemMetrics(SM_CYDRAG) {
                            *down = None;
                            GEN.fetch_add(1, Ordering::SeqCst);
                        }
                    }
                }
                WM_LBUTTONUP => {
                    *DOWN.lock().unwrap() = None;
                    GEN.fetch_add(1, Ordering::SeqCst);
                    if SHOWING.swap(false, Ordering::SeqCst) {
                        if let Some(w) = APP.get().and_then(|a| a.get_webview_window("peek")) {
                            let _ = w.hide();
                            let _ = w.emit("peek-hide", ());
                        }
                    }
                }
                _ => {}
            }
        }
        CallNextHookEx(None, code, wparam, lparam)
    }

    /// Runs on a worker thread after a 3 s still hold.
    fn on_hold(pt: POINT) {
        log(format!("hold at {},{}", pt.x, pt.y));
        let Some(path) = (unsafe { file_under(pt) }) else { log("no file under pointer"); return };
        log(format!("file: {path}"));
        let ext = path.rsplit('.').next().unwrap_or("").to_ascii_lowercase();
        if !SUPPORTED.contains(&ext.as_str()) {
            return;
        }
        if let Some(w) = APP.get().and_then(|a| a.get_webview_window("peek")) {
            SHOWING.store(true, Ordering::SeqCst);
            let _ = w.emit("peek-show", serde_json::json!({ "path": path, "x": pt.x, "y": pt.y }));
        }
    }

    unsafe fn class_of(hwnd: HWND) -> String {
        let mut buf = [0u16; 64];
        let n = GetClassNameW(hwnd, &mut buf);
        String::from_utf16_lossy(&buf[..n as usize])
    }

    /// The file Explorer (or the desktop) has focused under the pointer, if any.
    unsafe fn file_under(pt: POINT) -> Option<String> {
        let root = GetAncestor(WindowFromPoint(pt), GA_ROOT);
        let class = class_of(root);
        log(format!("window class: {class}"));
        let desktop = class == "Progman" || class == "WorkerW";
        if !desktop && class != "CabinetWClass" && class != "ExploreWClass" {
            return None;
        }
        let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
        let result = (|| -> Option<String> {
            let windows: IShellWindows = match CoCreateInstance(&ShellWindows, None, CLSCTX_ALL) {
                Ok(w) => w,
                Err(e) => { log(format!("ShellWindows: {e}")); return None }
            };
            let view = if desktop {
                let mut hwnd = 0i32;
                let disp = windows
                    .FindWindowSW(&VARIANT::from(0i32), &VARIANT::default(), SWC_DESKTOP, &mut hwnd, SWFO_NEEDDISPATCH)
                    .ok()?;
                folder_view(&disp)?
            } else {
                // Windows 11 Explorer tabs share one top-level window; the active tab is the first ShellTabWindowClass child.
                let active_tab = FindWindowExW(Some(root), None, w!("ShellTabWindowClass"), PCWSTR::null()).unwrap_or_default();
                let mut fallback = None;
                let mut found = None;
                for i in 0..windows.Count().ok()? {
                    let Ok(disp) = windows.Item(&VARIANT::from(i)) else { continue };
                    let Ok(browser) = disp.cast::<IWebBrowserApp>() else { continue };
                    if browser.HWND().ok().map(|h| h.0 as isize) != Some(root.0 as isize) {
                        continue;
                    }
                    let tab = disp
                        .cast::<IServiceProvider>()
                        .ok()
                        .and_then(|sp| sp.QueryService::<IShellBrowser>(&SID_STopLevelBrowser).ok())
                        .and_then(|sb| sb.GetWindow().ok());
                    if tab == Some(active_tab) {
                        found = Some(disp);
                        break;
                    }
                    fallback.get_or_insert(disp);
                }
                folder_view(&found.or(fallback)?)?
            };
            log("got folder view");
            // Pressing on empty space clears the selection, so require one.
            if view.SelectedItems().ok()?.Count().ok()? == 0 {
                return None;
            }
            let path: BSTR = view.FocusedItem().ok()?.Path().ok()?;
            Some(path.to_string())
        })();
        CoUninitialize();
        result
    }

    unsafe fn folder_view(disp: &IDispatch) -> Option<IShellFolderViewDual> {
        if let Ok(browser) = disp.cast::<IWebBrowserApp>() {
            return browser.Document().ok()?.cast().ok();
        }
        disp.cast().ok()
    }
}
