use tauri::{AppHandle, Emitter, Manager, State};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ShortcutsConfig {
    pub ptt_key: Option<String>,
    pub ptm_key: Option<String>,
    pub toggle_mute: Option<String>,
    pub toggle_deafen: Option<String>,
    pub overlay_toggle: Option<String>,
}

impl Default for ShortcutsConfig {
    fn default() -> Self {
        Self {
            ptt_key: None,
            ptm_key: None,
            toggle_mute: Some("Ctrl+Shift+M".into()),
            toggle_deafen: Some("Ctrl+Shift+D".into()),
            overlay_toggle: Some("Ctrl+Shift+O".into()),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VoiceOverlaySettings {
    pub enabled: bool,
    pub persistent_chat: bool,
    pub only_speaking: bool,
    pub show_messages: bool,
    pub scale: f64,
    pub opacity: f64,
    pub editing: bool,
    pub corner: String,
}

impl Default for VoiceOverlaySettings {
    fn default() -> Self {
        Self {
            enabled: false,
            persistent_chat: false,
            only_speaking: false,
            show_messages: true,
            scale: 1.0,
            opacity: 1.0,
            editing: false,
            corner: "top-left".into(),
        }
    }
}

pub struct AppState {
    pub shortcuts: Mutex<ShortcutsConfig>,
    pub server_history: Mutex<Vec<String>>,
    pub voice_state: Mutex<serde_json::Value>,
    pub overlay_settings: Mutex<VoiceOverlaySettings>,
    pub overlay_last_report: Mutex<Option<serde_json::Value>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            shortcuts: Mutex::new(ShortcutsConfig::default()),
            server_history: Mutex::new(vec!["https://haven.khanhs.io.vn".into()]),
            voice_state: Mutex::new(serde_json::json!({})),
            overlay_settings: Mutex::new(VoiceOverlaySettings::default()),
            overlay_last_report: Mutex::new(None),
        }
    }
}

// ── App & Window Controls ───────────────────────────────────────────────────

#[tauri::command]
pub fn get_app_version() -> String {
    "2.0.0-alpha.1".into()
}

#[tauri::command]
pub fn window_minimize(_app: AppHandle) -> Result<(), String> {
    #[cfg(desktop)]
    if let Some(w) = _app.get_webview_window("main") {
        let _ = w.minimize();
    }
    Ok(())
}

#[tauri::command]
pub fn window_maximize(_app: AppHandle) -> Result<(), String> {
    #[cfg(desktop)]
    if let Some(w) = _app.get_webview_window("main") {
        let is_max = w.is_maximized().unwrap_or(false);
        if is_max {
            let _ = w.unmaximize();
        } else {
            let _ = w.maximize();
        }
    }
    Ok(())
}

#[tauri::command]
pub fn window_close(app: AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.hide();
    }
    if let Some(overlay_win) = app.get_webview_window("overlay") {
        let _ = overlay_win.hide();
    }
    crate::tray::set_gaming_priority(true);
    Ok(())
}

#[tauri::command]
pub fn switch_server(app: AppHandle, state: State<AppState>, url: String) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("main") {
        let clean = url.trim().to_string();
        let _ = w.navigate(tauri::Url::parse(&clean).map_err(|e| e.to_string())?);
        let mut hist = state.server_history.lock().unwrap();
        if !hist.contains(&clean) {
            hist.push(clean);
        }
    }
    Ok(())
}

#[tauri::command]
pub fn get_shortcuts_config(state: State<AppState>) -> ShortcutsConfig {
    state.shortcuts.lock().unwrap().clone()
}

#[tauri::command]
pub fn set_shortcuts_config(state: State<AppState>, config: ShortcutsConfig) -> Result<(), String> {
    let mut lock = state.shortcuts.lock().unwrap();
    *lock = config;
    log::info!("Updated global shortcuts: {:?}", *lock);
    Ok(())
}

#[tauri::command]
pub fn update_voice_state(state: State<AppState>, voice_state: serde_json::Value) -> Result<(), String> {
    let mut lock = state.voice_state.lock().unwrap();
    *lock = voice_state;
    Ok(())
}

// ── Voice Overlay Commands ──────────────────────────────────────────────────

pub fn get_or_create_overlay(app: &AppHandle) -> Option<tauri::WebviewWindow> {
    #[cfg(not(desktop))]
    {
        let _ = app;
        return None;
    }
    #[cfg(desktop)]
    {
        if let Some(w) = app.get_webview_window("overlay") {
            return Some(w);
        }
        let overlay_builder = tauri::webview::WebviewWindowBuilder::new(
            app,
            "overlay",
            tauri::WebviewUrl::App("voice-overlay.html".into()),
        )
        .title("Haven Voice Overlay")
        .inner_size(360.0, 640.0)
        .position(20.0, 20.0)
        .resizable(false)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .visible(false)
        .initialization_script(crate::OVERLAY_BRIDGE_SCRIPT);

        match overlay_builder.build() {
            Ok(win) => {
                let _ = win.set_ignore_cursor_events(true);
                Some(win)
            }
            Err(e) => {
                log::warn!("Could not create overlay window: {}", e);
                None
            }
        }
    }
}

#[tauri::command]
pub fn is_voice_overlay_enabled(state: State<AppState>) -> bool {
    state.overlay_settings.lock().unwrap().enabled
}

#[tauri::command]
pub fn set_voice_overlay_enabled(app: AppHandle, state: State<AppState>, enabled: bool) -> Result<(), String> {
    state.overlay_settings.lock().unwrap().enabled = enabled;
    if !enabled {
        if let Some(w) = app.get_webview_window("overlay") {
            let _ = w.hide();
        }
    } else {
        if let Some(w) = get_or_create_overlay(&app) {
            let _ = w.show();
            #[cfg(desktop)]
            let _ = w.set_ignore_cursor_events(true);
        }
        let last = state.overlay_last_report.lock().unwrap().clone();
        if let Some(r) = last {
            let _ = app.emit_to("overlay", "voice-overlay:state", &r);
            let _ = app.emit("voice-overlay:state", &r);
        }
    }
    send_overlay_view(&app, &state);
    Ok(())
}

#[tauri::command]
pub fn toggle_voice_overlay_command(app: AppHandle, state: State<AppState>) -> Result<(), String> {
    let current = state.overlay_settings.lock().unwrap().enabled;
    set_voice_overlay_enabled(app, state, !current)
}

#[tauri::command]
pub fn toggle_voice_overlay_persistent(app: AppHandle, state: State<AppState>) -> Result<bool, String> {
    let mut settings = state.overlay_settings.lock().unwrap();
    settings.persistent_chat = !settings.persistent_chat;
    let new_val = settings.persistent_chat;
    let enabled = settings.enabled;
    drop(settings);
    send_overlay_view(&app, &state);

    let in_voice = state.overlay_last_report.lock().unwrap().as_ref()
        .and_then(|r| r.get("inVoice"))
        .and_then(|v| v.as_bool()).unwrap_or(false);

    if enabled && (new_val || in_voice) {
        if let Some(overlay_win) = get_or_create_overlay(&app) {
            let _ = overlay_win.show();
            #[cfg(desktop)]
            let _ = overlay_win.set_ignore_cursor_events(true);
        }
    } else if !new_val && !in_voice {
        if let Some(overlay_win) = app.get_webview_window("overlay") {
            let editing = state.overlay_settings.lock().unwrap().editing;
            if !editing && overlay_win.is_visible().unwrap_or(false) {
                let _ = overlay_win.hide();
            }
        }
    }
    Ok(new_val)
}

#[tauri::command]
pub fn clear_overlay_messages(app: AppHandle, state: State<AppState>) -> Result<(), String> {
    if let Some(ref mut rep) = *state.overlay_last_report.lock().unwrap() {
        if let Some(obj) = rep.as_object_mut() {
            obj.insert("messages".to_string(), serde_json::json!([]));
        }
    }
    let _ = app.emit("voice-overlay:clear-messages", &serde_json::json!({}));
    Ok(())
}

#[tauri::command]
pub fn report_voice_overlay(app: AppHandle, state: State<AppState>, report: serde_json::Value) -> Result<(), String> {
    let settings = state.overlay_settings.lock().unwrap().clone();
    *state.overlay_last_report.lock().unwrap() = Some(report.clone());

    let in_voice = report.get("inVoice").and_then(|v| v.as_bool()).unwrap_or(false);
    let has_messages = report.get("messages").and_then(|m| m.as_array()).map(|a| !a.is_empty()).unwrap_or(false);

    if settings.enabled && (settings.persistent_chat || in_voice || has_messages) {
        if let Some(overlay_win) = get_or_create_overlay(&app) {
            if !overlay_win.is_visible().unwrap_or(false) {
                let _ = overlay_win.show();
                #[cfg(desktop)]
                let _ = overlay_win.set_ignore_cursor_events(true);
            }
            let _ = app.emit_to("overlay", "voice-overlay:state", &report);
            let _ = app.emit("voice-overlay:state", &report);
        }
    } else {
        if let Some(overlay_win) = app.get_webview_window("overlay") {
            if !settings.editing && overlay_win.is_visible().unwrap_or(false) {
                let _ = overlay_win.hide();
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub fn voice_overlay_done(app: AppHandle, state: State<AppState>) -> Result<(), String> {
    state.overlay_settings.lock().unwrap().editing = false;
    if let Some(_w) = app.get_webview_window("overlay") {
        #[cfg(desktop)]
        let _ = _w.set_ignore_cursor_events(true);
    }
    send_overlay_view(&app, &state);
    Ok(())
}

#[tauri::command]
pub fn voice_overlay_set_editing(app: AppHandle, state: State<AppState>, editing: bool) -> Result<(), String> {
    state.overlay_settings.lock().unwrap().editing = editing;
    if let Some(w) = get_or_create_overlay(&app) {
        if editing {
            let _ = w.show();
            #[cfg(desktop)]
            let _ = w.set_ignore_cursor_events(false);
            let _ = w.set_focus();
        } else {
            #[cfg(desktop)]
            let _ = w.set_ignore_cursor_events(true);
        }
    }
    send_overlay_view(&app, &state);
    Ok(())
}

#[tauri::command]
pub fn voice_overlay_snap(app: AppHandle, state: State<AppState>, corner: String) -> Result<(), String> {
    state.overlay_settings.lock().unwrap().corner = corner.clone();
    if let Some(w) = get_or_create_overlay(&app) {
        let pos = match corner.as_str() {
            "top-right" => (1920 - 380, 20),
            "bottom-left" => (20, 1080 - 660),
            "bottom-right" => (1920 - 380, 1080 - 660),
            _ => (20, 20), // top-left
        };
        let _ = w.set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(pos.0, pos.1)));
    }
    send_overlay_view(&app, &state);
    Ok(())
}

pub fn send_overlay_view(app: &AppHandle, state: &State<AppState>) {
    let settings = state.overlay_settings.lock().unwrap().clone();
    let align = if settings.corner.contains("right") { "right" } else { "left" };
    let idle_text = if settings.persistent_chat {
        "Haven HUD: Đang chờ tin nhắn..."
    } else {
        "Tham gia phòng thoại để thấy thành viên tại đây."
    };
    let view_payload = serde_json::json!({
        "persistentChat": settings.persistent_chat,
        "onlySpeaking": settings.only_speaking,
        "showMessages": settings.show_messages,
        "scale": settings.scale,
        "opacity": settings.opacity,
        "messageSeconds": if settings.persistent_chat { 60 } else { 12 },
        "editing": settings.editing,
        "align": align,
        "labels": {
            "move": "Kéo để di chuyển vị trí HUD",
            "done": "Xong",
            "idle": idle_text
        }
    });
    let _ = app.emit_to("overlay", "voice-overlay:view", &view_payload);
    let _ = app.emit("voice-overlay:view", &view_payload);
}

// ────────────────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn is_audio_capture_supported() -> bool {
    true
}

#[tauri::command]
pub fn stop_audio_capture() -> Result<(), String> {
    log::info!("Audio loopback capture stopped");
    Ok(())
}

#[tauri::command]
pub fn get_server_history(state: State<AppState>) -> Vec<String> {
    state.server_history.lock().unwrap().clone()
}

// ── Native Downloads & External Link Handlers ────────────────────────────────

#[tauri::command]
pub fn open_external_url(url: String) -> Result<(), String> {
    log::info!("Opening external URL: {}", url);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        let clean = url.trim();
        if clean.starts_with("http://") || clean.starts_with("https://") || clean.starts_with("mailto:") {
            let _ = std::process::Command::new("cmd")
                .args(["/c", "start", "", clean])
                .creation_flags(CREATE_NO_WINDOW)
                .spawn();
        }
    }
    #[cfg(all(unix, not(target_os = "android")))]
    {
        let _ = std::process::Command::new("xdg-open").arg(&url).spawn();
    }
    Ok(())
}

#[tauri::command]
pub fn save_download_file(filename: String, data: Vec<u8>) -> Result<String, String> {
    if data.is_empty() {
        return Err("Cannot save empty file".into());
    }

    let downloads_dir = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .map(|p| std::path::PathBuf::from(p).join("Downloads"))
        .unwrap_or_else(|_| std::env::temp_dir());

    if !downloads_dir.exists() {
        let _ = std::fs::create_dir_all(&downloads_dir);
    }

    let clean_name = filename
        .replace(['\\', '/', ':', '*', '?', '"', '<', '>', '|'], "_")
        .trim()
        .to_string();
    let safe_filename = if clean_name.is_empty() {
        "downloaded_file".to_string()
    } else {
        clean_name
    };

    let (stem, ext) = match safe_filename.rfind('.') {
        Some(idx) if idx > 0 => (&safe_filename[..idx], &safe_filename[idx..]),
        _ => (safe_filename.as_str(), ""),
    };

    let mut dest = downloads_dir.join(&safe_filename);
    let mut counter = 1;
    while dest.exists() {
        let candidate = format!("{} ({}){}", stem, counter, ext);
        dest = downloads_dir.join(&candidate);
        counter += 1;
        if counter > 1000 {
            break;
        }
    }

    log::info!("Saving downloaded file to: {:?}", dest);
    std::fs::write(&dest, &data).map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(dest.to_string_lossy().to_string())
}

#[tauri::command]
pub fn show_in_folder(_path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        let _ = std::process::Command::new("explorer")
            .args(["/select,", &_path])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn();
    }
    #[cfg(all(unix, not(target_os = "android")))]
    {
        if let Some(parent) = std::path::Path::new(&_path).parent() {
            let _ = std::process::Command::new("xdg-open").arg(parent).spawn();
        }
    }
    Ok(())
}

