pub mod commands;
#[cfg(desktop)]
pub mod tray;
#[cfg(not(desktop))]
pub mod tray {
    use tauri::AppHandle;
    pub fn setup_tray(_app: &AppHandle) -> tauri::Result<()> { Ok(()) }
    pub fn set_gaming_priority(_is_gaming: bool) {}
    pub fn trim_working_set() {}
}

use commands::*;
#[cfg(desktop)]
use tauri::webview::{PermissionResponse, WebviewWindowBuilder};
use tauri::Manager;

pub const BRIDGE_SCRIPT: &str = include_str!("../../src/tauri-bridge/haven-bridge.js");
pub const OVERLAY_BRIDGE_SCRIPT: &str = r#"
(function() {
  if (window.__TAURI__ && window.__TAURI__.event) {
    window.voiceOverlay = {
      onView: function(fn) {
        window.__TAURI__.event.listen('voice-overlay:view', function(e) { fn(e.payload); });
      },
      onState: function(fn) {
        window.__TAURI__.event.listen('voice-overlay:state', function(e) { fn(e.payload); });
      },
      onClearMessages: function(fn) {
        window.__TAURI__.event.listen('voice-overlay:clear-messages', function(e) { fn(e.payload); });
      },
      done: function() {
        if (window.__TAURI__.core) {
          window.__TAURI__.core.invoke('voice_overlay_done');
        }
      }
    };
  }
})();
"#;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .setup(|app| {
            let app_handle = app.handle();
            let _ = tray::setup_tray(app_handle);

            // 1. Construct Main Window from config, bind bridge script & auto-permissions
            #[cfg(desktop)]
            if let Some(win_cfg) = app.config().app.windows.first() {
                let mut builder = WebviewWindowBuilder::from_config(app_handle, win_cfg)?;
                builder = builder
                    .initialization_script(BRIDGE_SCRIPT)
                    .on_permission_request(|_webview, _kind| PermissionResponse::Allow)
                    .on_download(|_webview, event| {
                        match event {
                            tauri::webview::DownloadEvent::Requested { url, destination } => {
                                log::info!("Native download requested for {} to {:?}", url, destination);
                            }
                            tauri::webview::DownloadEvent::Finished { url, path, success } => {
                                log::info!("Native download finished for {}: success={}, path={:?}", url, success, path);
                            }
                            _ => {}
                        }
                        true
                    });
                let _window = builder.build()?;

                // Close-to-Tray: Hide to tray instead of terminating when user clicks Close (✕)
                let win_clone = _window.clone();
                let app_h = app_handle.clone();
                _window.on_window_event(move |event| {
                    match event {
                        tauri::WindowEvent::CloseRequested { api, .. } => {
                            api.prevent_close();
                            let _ = win_clone.hide();
                            if let Some(overlay_win) = app_h.get_webview_window("overlay") {
                                let _ = overlay_win.hide();
                            }
                            tray::set_gaming_priority(true);
                        }
                        tauri::WindowEvent::Focused(false) => {
                            // User is gaming: Yield 100% CPU priority to the game (240 FPS)
                            tray::set_gaming_priority(true);
                        }
                        tauri::WindowEvent::Focused(true) => {
                            // User returned to Haven: Restore normal priority
                            tray::set_gaming_priority(false);
                        }
                        _ => {}
                    }
                });
            }

            #[cfg(mobile)]
            {
                // Managed by Android MainActivity & WebChromeClient
            }

            // 2. In-Game Voice & Chat Overlay Window is created on-demand by get_or_create_overlay

            // Staggered initialization: send initial view settings after event loop starts
            #[cfg(desktop)]
            {
                let init_app = app_handle.clone();
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_millis(800));
                    let app_state: tauri::State<AppState> = init_app.state();
                    commands::send_overlay_view(&init_app, &app_state);
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_app_version,
            window_minimize,
            window_maximize,
            window_close,
            get_shortcuts_config,
            set_shortcuts_config,
            stop_audio_capture,
            get_server_history,
            switch_server,
            update_voice_state,
            report_voice_overlay,
            is_voice_overlay_enabled,
            set_voice_overlay_enabled,
            voice_overlay_set_editing,
            voice_overlay_snap,
            toggle_voice_overlay_command,
            toggle_voice_overlay_persistent,
            clear_overlay_messages,
            voice_overlay_done,
            open_external_url,
            save_download_file,
            show_in_folder
        ])
        .run(tauri::generate_context!())
        .expect("error while running haven desktop application");
}
