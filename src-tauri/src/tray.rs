use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, State,
};
use crate::commands::AppState;

#[repr(C)]
struct ProcessMemoryCounters {
    cb: u32,
    page_fault_count: u32,
    peak_working_set_size: usize,
    working_set_size: usize,
    quota_peak_paged_pool_usage: usize,
    quota_paged_pool_usage: usize,
    quota_peak_non_paged_pool_usage: usize,
    quota_non_paged_pool_usage: usize,
    pagefile_usage: usize,
    peak_pagefile_usage: usize,
}

#[allow(non_snake_case)]
#[repr(C)]
struct PROCESSENTRY32W {
    dwSize: u32,
    cntUsage: u32,
    th32ProcessID: u32,
    th32DefaultHeapID: usize,
    th32ModuleID: u32,
    cntThreads: u32,
    th32ParentProcessID: u32,
    pcPriClassBase: i32,
    dwFlags: u32,
    szExeFile: [u16; 260],
}

#[cfg(target_os = "windows")]
#[link(name = "kernel32")]
extern "system" {
    fn GetCurrentProcess() -> isize;
    fn GetCurrentProcessId() -> u32;
    fn K32GetProcessMemoryInfo(process: isize, pps_mem_counters: *mut ProcessMemoryCounters, cb: u32) -> i32;
    fn K32EmptyWorkingSet(process: isize) -> i32;
    fn SetProcessWorkingSetSize(process: isize, min: usize, max: usize) -> i32;
    fn CreateToolhelp32Snapshot(dwFlags: u32, th32ProcessID: u32) -> isize;
    fn Process32FirstW(hSnapshot: isize, lppe: *mut PROCESSENTRY32W) -> i32;
    fn Process32NextW(hSnapshot: isize, lppe: *mut PROCESSENTRY32W) -> i32;
    fn OpenProcess(dwDesiredAccess: u32, bInheritHandle: i32, dwProcessId: u32) -> isize;
    fn CloseHandle(hObject: isize) -> i32;
    fn SetPriorityClass(hProcess: isize, dwPriorityClass: u32) -> i32;
}

pub const NORMAL_PRIORITY_CLASS: u32 = 0x00000020;
pub const BELOW_NORMAL_PRIORITY_CLASS: u32 = 0x00004000;

/// Drops priority of Haven and all WebView2 child processes so running games get 100% CPU priority (240 FPS)
pub fn set_gaming_priority(is_gaming_or_unfocused: bool) {
    #[cfg(target_os = "windows")]
    unsafe {
        let prio = if is_gaming_or_unfocused {
            BELOW_NORMAL_PRIORITY_CLASS
        } else {
            NORMAL_PRIORITY_CLASS
        };
        let my_pid = GetCurrentProcessId();
        let _ = SetPriorityClass(GetCurrentProcess(), prio);
        let family_pids = get_descendant_pids(my_pid);
        for pid in family_pids {
            if pid != my_pid {
                let h = OpenProcess(0x0200, 0, pid); // PROCESS_SET_INFORMATION
                if h != 0 {
                    let _ = SetPriorityClass(h, prio);
                    CloseHandle(h);
                }
            }
        }
    }
}

/// Recursively discovers all child and grandchild processes of root_pid (e.g. all msedgewebview2.exe subprocesses)
pub fn get_descendant_pids(root_pid: u32) -> Vec<u32> {
    let mut family = std::collections::HashSet::new();
    family.insert(root_pid);

    #[cfg(target_os = "windows")]
    unsafe {
        let snapshot = CreateToolhelp32Snapshot(0x00000002, 0); // TH32CS_SNAPPROCESS
        if snapshot != -1 && snapshot != 0 {
            let mut all_procs: Vec<(u32, u32)> = Vec::new();
            let mut entry = std::mem::zeroed::<PROCESSENTRY32W>();
            entry.dwSize = std::mem::size_of::<PROCESSENTRY32W>() as u32;
            if Process32FirstW(snapshot, &mut entry) != 0 {
                loop {
                    all_procs.push((entry.th32ProcessID, entry.th32ParentProcessID));
                    if Process32NextW(snapshot, &mut entry) == 0 {
                        break;
                    }
                }
            }
            CloseHandle(snapshot);

            let mut added = true;
            while added {
                added = false;
                for (pid, parent_pid) in &all_procs {
                    if family.contains(parent_pid) && !family.contains(pid) {
                        family.insert(*pid);
                        added = true;
                    }
                }
            }
        }
    }
    family.into_iter().collect()
}

/// Flushes working set pages for Haven AND all descendant WebView2 processes (Browser, GPU, Renderer, Audio, Utility)
pub fn trim_working_set() {
    #[cfg(target_os = "windows")]
    unsafe {
        let my_pid = GetCurrentProcessId();
        let family_pids = get_descendant_pids(my_pid);
        for pid in family_pids {
            let handle = if pid == my_pid {
                GetCurrentProcess()
            } else {
                let h = OpenProcess(0x0100 | 0x0400 | 0x0010, 0, pid);
                if h == 0 {
                    OpenProcess(0x1F0FFF, 0, pid)
                } else {
                    h
                }
            };
            if handle != 0 {
                SetProcessWorkingSetSize(handle, usize::MAX, usize::MAX);
                K32EmptyWorkingSet(handle);
                if pid != my_pid {
                    CloseHandle(handle);
                }
            }
        }
    }
}

/// Calculates actual total physical RAM consumed by Haven and all of its WebView2 instances
pub fn get_current_ram_mb() -> usize {
    #[cfg(target_os = "windows")]
    unsafe {
        let my_pid = GetCurrentProcessId();
        let family_pids = get_descendant_pids(my_pid);
        let mut total_bytes = 0usize;
        for pid in family_pids {
            let handle = if pid == my_pid {
                GetCurrentProcess()
            } else {
                OpenProcess(0x0400, 0, pid)
            };
            if handle != 0 {
                let mut counters: ProcessMemoryCounters = std::mem::zeroed();
                counters.cb = std::mem::size_of::<ProcessMemoryCounters>() as u32;
                if K32GetProcessMemoryInfo(handle, &mut counters, counters.cb) != 0 {
                    total_bytes += counters.working_set_size;
                }
                if pid != my_pid {
                    CloseHandle(handle);
                }
            }
        }
        total_bytes / (1024 * 1024)
    }
    #[cfg(not(target_os = "windows"))]
    0
}

pub fn is_autostart_enabled() -> bool {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let output = std::process::Command::new("reg")
            .args(["query", "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run", "/v", "HavenDesktop"])
            .creation_flags(0x08000000)
            .output();
        if let Ok(out) = output {
            return out.status.success();
        }
    }
    false
}

pub fn toggle_autostart() -> bool {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let currently_enabled = is_autostart_enabled();
        if currently_enabled {
            let _ = std::process::Command::new("reg")
                .args(["delete", "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run", "/v", "HavenDesktop", "/f"])
                .creation_flags(0x08000000)
                .output();
            false
        } else {
            if let Ok(current_exe) = std::env::current_exe() {
                let path_str = current_exe.to_string_lossy().to_string();
                let reg_val = format!("\"{}\"", path_str);
                let _ = std::process::Command::new("reg")
                    .args(["add", "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run", "/v", "HavenDesktop", "/t", "REG_SZ", "/d", &reg_val, "/f"])
                    .creation_flags(0x08000000)
                    .output();
                return true;
            }
            false
        }
    }
    #[cfg(not(target_os = "windows"))]
    false
}

pub fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
    let open_i = MenuItem::with_id(app, "open", "Mở Haven", true, None::<&str>)?;
    let reload_i = MenuItem::with_id(app, "reload", "Tải lại trang (F5)", true, None::<&str>)?;
    let trim_i = MenuItem::with_id(app, "trim_ram", "Giải phóng RAM ngay", true, None::<&str>)?;

    let autostart_text = if is_autostart_enabled() {
        "Khởi động cùng Windows: [BẬT]"
    } else {
        "Khởi động cùng Windows: [TẮT]"
    };
    let autostart_i = MenuItem::with_id(app, "toggle_autostart", autostart_text, true, None::<&str>)?;

    let overlay_toggle_i = MenuItem::with_id(app, "toggle_overlay", "Bật/Tắt Voice Overlay (HUD)", true, None::<&str>)?;
    let app_state: State<AppState> = app.state();
    let persistent_text = if app_state.overlay_settings.lock().unwrap().persistent_chat {
        "Luôn hiện Overlay (Đọc Chat): [BẬT]"
    } else {
        "Luôn hiện Overlay (Đọc Chat): [TẮT]"
    };
    let persistent_i = MenuItem::with_id(app, "toggle_persistent", persistent_text, true, None::<&str>)?;
    let clear_msgs_i = MenuItem::with_id(app, "clear_msgs", "Xóa tin nhắn trên Overlay", true, None::<&str>)?;
    let overlay_move_i = MenuItem::with_id(app, "move_overlay", "Di chuyển vị trí Overlay", true, None::<&str>)?;
    let snap_tl_i = MenuItem::with_id(app, "snap_tl", "Góc trên - Bên trái", true, None::<&str>)?;
    let snap_tr_i = MenuItem::with_id(app, "snap_tr", "Góc trên - Bên phải", true, None::<&str>)?;
    let snap_bl_i = MenuItem::with_id(app, "snap_bl", "Góc dưới - Bên trái", true, None::<&str>)?;
    let snap_br_i = MenuItem::with_id(app, "snap_br", "Góc dưới - Bên phải", true, None::<&str>)?;
    let snap_sub = Submenu::with_items(app, "Ghim vào góc màn hình", true, &[&snap_tl_i, &snap_tr_i, &snap_bl_i, &snap_br_i])?;
    let overlay_sub = Submenu::with_items(app, "Voice Overlay (In-Game HUD)", true, &[&overlay_toggle_i, &persistent_i, &clear_msgs_i, &overlay_move_i, &snap_sub])?;

    let sep1 = PredefinedMenuItem::separator(app)?;
    let mute_i = MenuItem::with_id(app, "toggle_mute", "Bật/Tắt Mic", true, None::<&str>)?;
    let deafen_i = MenuItem::with_id(app, "toggle_deafen", "Bật/Tắt Tai nghe", true, None::<&str>)?;
    let sep2 = PredefinedMenuItem::separator(app)?;
    let quit_i = MenuItem::with_id(app, "quit", "Thoát Haven", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[
            &open_i,
            &reload_i,
            &trim_i,
            &autostart_i,
            &sep1,
            &overlay_sub,
            &mute_i,
            &deafen_i,
            &sep2,
            &quit_i,
        ],
    )?;

    let ram_mb = get_current_ram_mb();
    let initial_tooltip = if ram_mb > 0 {
        format!("Haven Desktop (240 FPS Game-Optimized) | RAM: {} MB", ram_mb)
    } else {
        "Haven Desktop (240 FPS Game-Optimized)".to_string()
    };

    let _tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .tooltip(&initial_tooltip)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => {
                set_gaming_priority(false);
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "reload" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.eval("window.location.reload();");
                }
            }
            "trim_ram" => {
                let app_c = app.clone();
                if let Some(main_win) = app_c.get_webview_window("main") {
                    let _ = main_win.eval("if (window.gc) window.gc();");
                }
                if let Some(overlay_win) = app_c.get_webview_window("overlay") {
                    let _ = overlay_win.eval("if (window.gc) window.gc();");
                }
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_millis(150));
                    trim_working_set();
                    let ram = get_current_ram_mb();
                    log::info!("Full recursive RAM working set trim triggered. Current: {} MB", ram);
                });
            }
            "toggle_autostart" => {
                let enabled = toggle_autostart();
                log::info!("Auto-start toggled: {}", enabled);
            }
            "toggle_overlay" => {
                let state: State<AppState> = app.state();
                let current = state.overlay_settings.lock().unwrap().enabled;
                let _ = crate::commands::set_voice_overlay_enabled(app.clone(), state, !current);
            }
            "toggle_persistent" => {
                let state: State<AppState> = app.state();
                let _ = crate::commands::toggle_voice_overlay_persistent(app.clone(), state);
            }
            "clear_msgs" => {
                let state: State<AppState> = app.state();
                let _ = crate::commands::clear_overlay_messages(app.clone(), state);
            }
            "move_overlay" => {
                let state: State<AppState> = app.state();
                let editing = state.overlay_settings.lock().unwrap().editing;
                let _ = crate::commands::voice_overlay_set_editing(app.clone(), state, !editing);
            }
            "snap_tl" => {
                let state: State<AppState> = app.state();
                let _ = crate::commands::voice_overlay_snap(app.clone(), state, "top-left".into());
            }
            "snap_tr" => {
                let state: State<AppState> = app.state();
                let _ = crate::commands::voice_overlay_snap(app.clone(), state, "top-right".into());
            }
            "snap_bl" => {
                let state: State<AppState> = app.state();
                let _ = crate::commands::voice_overlay_snap(app.clone(), state, "bottom-left".into());
            }
            "snap_br" => {
                let state: State<AppState> = app.state();
                let _ = crate::commands::voice_overlay_snap(app.clone(), state, "bottom-right".into());
            }
            "toggle_mute" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.eval("document.getElementById('mic-toggle-btn')?.click();");
                }
            }
            "toggle_deafen" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.eval("document.getElementById('deafen-toggle-btn')?.click();");
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                set_gaming_priority(false);
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }

                // Update RAM tooltip on tray click
                let ram = get_current_ram_mb();
                if ram > 0 {
                    let _ = tray.set_tooltip(Some(format!("Haven Desktop (240 FPS Game-Optimized) | RAM: {} MB", ram)));
                }
            }
        })
        .build(app)?;

    Ok(())
}
