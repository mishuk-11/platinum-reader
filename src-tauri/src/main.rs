#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod peek;

use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{Emitter, Manager};

/// Files given on the command line (or by the OS) before the UI asked for them.
struct Pending(Mutex<Vec<String>>);

fn file_args(args: &[String], cwd: &str) -> Vec<String> {
    args.iter()
        .skip(1)
        .filter(|a| !a.starts_with('-'))
        .map(|a| {
            let p = PathBuf::from(a);
            if p.is_absolute() { p } else { Path::new(cwd).join(p) }
        })
        .filter(|p| p.is_file())
        .map(|p| p.to_string_lossy().into_owned())
        .collect()
}

/// Raw bytes over IPC (no JSON/base64 cost), so big documents load fast.
#[tauri::command]
fn read_file(path: String) -> Result<tauri::ipc::Response, String> {
    std::fs::read(&path).map(tauri::ipc::Response::new).map_err(|e| format!("{path}: {e}"))
}

#[tauri::command]
fn file_size(path: String) -> u64 {
    std::fs::metadata(path).map(|m| m.len()).unwrap_or(0)
}

fn update_dir_path() -> PathBuf {
    std::env::temp_dir().join("platinum-reader-update")
}

#[tauri::command]
fn update_dir() -> String {
    update_dir_path().to_string_lossy().into_owned()
}

/// Downloads a release asset with the OS's own curl (built into Windows 10+, Linux, macOS).
#[tauri::command]
async fn download_update(url: String, name: String) -> Result<String, String> {
    // Only GitHub release assets, and a plain file name: these come from the network.
    if !url.starts_with("https://github.com/") || name.is_empty() || name.contains(['/', '\\', ':']) || name.starts_with('.') {
        return Err("refused: unexpected download URL or file name".into());
    }
    let dir = update_dir_path();
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let out = dir.join(&name);
    let mut cmd = std::process::Command::new("curl");
    cmd.args(["-fsSL", "--retry", "2", "-o"]).arg(&out).arg(&url);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000);
    }
    let status = tauri::async_runtime::spawn_blocking(move || cmd.status()).await.map_err(|e| e.to_string())?.map_err(|e| e.to_string())?;
    if !status.success() {
        return Err(format!("download failed ({status})"));
    }
    Ok(out.to_string_lossy().into_owned())
}

/// Starts a downloaded installer and closes the app so files can be replaced.
#[tauri::command]
fn run_installer(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if p.parent() != Some(update_dir_path().as_path()) || p.extension().and_then(|e| e.to_str()) != Some("exe") {
        return Err("refused: not a downloaded installer".into());
    }
    std::process::Command::new(&p).spawn().map_err(|e| e.to_string())?;
    app.exit(0);
    Ok(())
}

/// Turns the Explorer/desktop hold-to-preview helper on or off.
#[tauri::command]
fn set_peek_helper(enabled: bool) {
    peek::set_enabled(enabled);
}

#[tauri::command]
fn open_devtools(window: tauri::WebviewWindow) {
    window.open_devtools();
}

#[tauri::command]
fn pending_files(state: tauri::State<Pending>) -> Vec<String> {
    std::mem::take(&mut *state.0.lock().unwrap())
}

/// Unpacks a .chm into a temp folder and returns every file in it (relative paths).
#[tauri::command]
fn extract_chm(path: String) -> Result<(String, Vec<String>), String> {
    let stamp = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis();
    let out = std::env::temp_dir().join(format!("platinum-chm-{stamp}"));
    std::fs::create_dir_all(&out).map_err(|e| e.to_string())?;

    #[cfg(windows)]
    let tools: Vec<(&str, Vec<String>)> = vec![(
        "hh.exe",
        vec!["-decompile".into(), out.to_string_lossy().into(), path.clone()],
    )];
    #[cfg(not(windows))]
    let tools: Vec<(&str, Vec<String>)> = vec![
        ("7z", vec!["x".into(), "-y".into(), format!("-o{}", out.to_string_lossy()), path.clone()]),
        ("extract_chmLib", vec![path.clone(), out.to_string_lossy().into()]),
    ];
    // hh.exe returns odd exit codes, so success = "files appeared".
    for (bin, args) in tools {
        let _ = std::process::Command::new(bin).args(&args).status();
        let files = walk(&out, &out);
        if !files.is_empty() {
            return Ok((out.to_string_lossy().into_owned(), files));
        }
    }
    Err("Could not extract CHM. On Linux/macOS install p7zip (7z) or chmlib.".into())
}

fn walk(root: &Path, dir: &Path) -> Vec<String> {
    let mut v = Vec::new();
    if let Ok(rd) = std::fs::read_dir(dir) {
        for e in rd.flatten() {
            let p = e.path();
            if p.is_dir() {
                v.extend(walk(root, &p));
            } else if let Ok(rel) = p.strip_prefix(root) {
                v.push(rel.to_string_lossy().replace('\\', "/"));
            }
        }
    }
    v
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.iter().any(|a| a == peek::HELPER_ARG) {
        return peek::run_helper();
    }
    let cwd = std::env::current_dir().map(|p| p.to_string_lossy().into_owned()).unwrap_or_default();

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            let files = file_args(&args, &cwd);
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
            let _ = app.emit_to("main", "open-files", files);
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(Pending(Mutex::new(file_args(&args, &cwd))))
        .invoke_handler(tauri::generate_handler![read_file, file_size, pending_files, extract_chm, open_devtools, set_peek_helper, update_dir, download_update, run_installer])
        .build(tauri::generate_context!())
        .expect("error while running Platinum Reader")
        .run(|_app, _event| {
            // macOS delivers "Open with" files as an event instead of argv.
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Opened { urls } = _event {
                let files: Vec<String> = urls
                    .iter()
                    .filter_map(|u| u.to_file_path().ok())
                    .map(|p| p.to_string_lossy().into_owned())
                    .collect();
                _app.state::<Pending>().0.lock().unwrap().extend(files.clone());
                let _ = _app.emit_to("main", "open-files", files);
            }
        });
}
