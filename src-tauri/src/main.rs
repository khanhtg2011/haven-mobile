// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(target_os = "windows")]
extern "system" {
    fn CreateMutexW(lpMutexAttributes: *const std::ffi::c_void, bInitialOwner: i32, lpName: *const u16) -> isize;
    fn GetLastError() -> u32;
    fn FindWindowW(lpClassName: *const u16, lpWindowName: *const u16) -> isize;
    fn ShowWindow(hWnd: isize, nCmdShow: i32) -> i32;
    fn SetForegroundWindow(hWnd: isize) -> i32;
}

#[cfg(target_os = "windows")]
const ERROR_ALREADY_EXISTS: u32 = 183;
#[cfg(target_os = "windows")]
const SW_RESTORE: i32 = 9;

fn main() {
    #[cfg(target_os = "windows")]
    {
        // 1. Single-Instance Lock: Prevent duplicate Haven processes
        let mutex_name: Vec<u16> = "HavenDesktopTauriSingleInstanceMutex\0".encode_utf16().collect();
        let _handle = unsafe { CreateMutexW(std::ptr::null(), 1, mutex_name.as_ptr()) };
        if _handle != 0 && unsafe { GetLastError() } == ERROR_ALREADY_EXISTS {
            let title: Vec<u16> = "Haven\0".encode_utf16().collect();
            let hwnd = unsafe { FindWindowW(std::ptr::null(), title.as_ptr()) };
            if hwnd != 0 {
                unsafe {
                    ShowWindow(hwnd, SW_RESTORE);
                    SetForegroundWindow(hwnd);
                }
            }
            return;
        }

        // 2. High-Performance Gaming Flags for WebView2:
        // - CalculateNativeWinOcclusion: Stop GPU compositing completely when game is in front
        // - IntensiveWakeupThrottling: Stop CPU timer wakeups in background
        // - disable-background-timer-throttling=false: Throttle non-critical JS timers in background
        // - disable-renderer-backgrounding=false: Put background renderers in low power
        let current_args = std::env::var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS").unwrap_or_default();
        let gaming_args = "--enable-features=CalculateNativeWinOcclusion,IntensiveWakeupThrottling --disable-background-timer-throttling=false --disable-renderer-backgrounding=false";
        let final_args = if current_args.is_empty() {
            gaming_args.to_string()
        } else {
            format!("{} {}", current_args, gaming_args)
        };
        std::env::set_var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", final_args);
    }

    haven_desktop_lib::run();
}
