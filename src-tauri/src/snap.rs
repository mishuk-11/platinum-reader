//! Windows 11 Snap Layouts on our HTML maximize button.
//!
//! Windows shows the flyout when the window under the mouse answers WM_NCHITTEST with HTMAXBUTTON.
//! Our button is HTML, and WebView2's input window (owned by the browser process) answers for it.
//! So a small, unpainted child window of ours sits over the button and answers HTMAXBUTTON. Since
//! the web page no longer gets the mouse there, this window also mirrors hover to the HTML button
//! (the "max-hover" event) and toggles maximize on click.

use std::collections::HashMap;
use std::sync::{LazyLock, Mutex};
use tauri::{Emitter, WebviewWindow};
use windows::core::w;
use windows::Win32::Foundation::*;
use windows::Win32::Graphics::Gdi::ValidateRect;
use windows::Win32::System::LibraryLoader::GetModuleHandleW;
use windows::Win32::UI::Input::KeyboardAndMouse::{TrackMouseEvent, TME_LEAVE, TME_NONCLIENT, TRACKMOUSEEVENT};
use windows::Win32::UI::WindowsAndMessaging::*;

/// Overlay HWND → the app window it belongs to and whether the mouse is over it.
static OVERLAYS: LazyLock<Mutex<HashMap<isize, (WebviewWindow, bool)>>> = LazyLock::new(Default::default);

/// Moves the overlay over the button (client pixels); an empty rect hides it (full screen).
pub fn set_rect(window: &WebviewWindow, rect: RECT) {
    let Ok(raw) = window.hwnd() else { return };
    let main = HWND(raw.0);
    // Never hold the lock across Win32 calls: they send messages back into overlay_proc.
    let known = OVERLAYS.lock().unwrap().iter().find(|(_, (w, _))| w.label() == window.label()).map(|(o, _)| *o);
    let overlay = match known {
        Some(o) => HWND(o as _),
        None => {
            let Some(o) = (unsafe { create(main) }) else { return };
            OVERLAYS.lock().unwrap().insert(o.0 as isize, (window.clone(), false));
            o
        }
    };
    let empty = rect.right <= rect.left || rect.bottom <= rect.top;
    let show = if empty { SWP_HIDEWINDOW } else { SWP_SHOWWINDOW };
    unsafe {
        let _ = SetWindowPos(overlay, Some(HWND_TOP), rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top, SWP_NOACTIVATE | show);
    }
}

unsafe fn create(main: HWND) -> Option<HWND> {
    let instance = GetModuleHandleW(None).ok()?;
    let class = w!("PlatinumSnapOverlay");
    let wc = WNDCLASSW { lpfnWndProc: Some(overlay_proc), hInstance: instance.into(), lpszClassName: class, ..Default::default() };
    RegisterClassW(&wc); // fails harmlessly when a second window registers it again
    CreateWindowExW(WS_EX_NOACTIVATE, class, None, WS_CHILD, 0, 0, 0, 0, Some(main), None, Some(instance.into()), None).ok()
}

fn hover(overlay: HWND, on: bool) {
    if let Some((w, state)) = OVERLAYS.lock().unwrap().get_mut(&(overlay.0 as isize)) {
        if *state != on {
            *state = on;
            let _ = w.emit_to(w.label(), "max-hover", on);
        }
    }
}

unsafe extern "system" fn overlay_proc(hwnd: HWND, msg: u32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    match msg {
        WM_NCHITTEST => return LRESULT(HTMAXBUTTON as isize),
        // Paint nothing, so the HTML button under it stays visible.
        WM_ERASEBKGND => return LRESULT(1),
        WM_PAINT => {
            let _ = ValidateRect(Some(hwnd), None);
            return LRESULT(0);
        }
        WM_NCMOUSEMOVE => {
            let mut tme = TRACKMOUSEEVENT { cbSize: size_of::<TRACKMOUSEEVENT>() as u32, dwFlags: TME_LEAVE | TME_NONCLIENT, hwndTrack: hwnd, dwHoverTime: 0 };
            let _ = TrackMouseEvent(&mut tme);
            hover(hwnd, true);
            return LRESULT(0);
        }
        WM_NCMOUSELEAVE => {
            hover(hwnd, false);
            return LRESULT(0);
        }
        // Swallow the press (the default would draw an old-style caption button); act on release.
        WM_NCLBUTTONDOWN | WM_NCLBUTTONDBLCLK => return LRESULT(0),
        WM_NCLBUTTONUP => {
            if let Ok(main) = GetParent(hwnd) {
                let _ = ShowWindow(main, if IsZoomed(main).as_bool() { SW_RESTORE } else { SW_MAXIMIZE });
            }
            return LRESULT(0);
        }
        _ => {}
    }
    DefWindowProcW(hwnd, msg, wparam, lparam)
}
