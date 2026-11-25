# Haven Mobile (Android Tauri v2 Edition)

The Android client for **Haven**, built on **Tauri v2**, native Android **Chromium WebView** document-start injection, and the **Mobile Focus View** Discord-style touch UI.

---

## Key Features

- **Native Chromium Document-Start Injection (`src-tauri/gen/android/`):**
  - `MainActivity.kt` injects `assets/mobile-focus.js` via `WebViewCompat.addDocumentStartJavaScript` before page render and periodically guards SPA transitions.
  - Requests runtime permissions (`RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`, `CAMERA`, and `POST_NOTIFICATIONS` on Android 13+) on startup.
- **Mobile Focus View Touch UX:**
  - Responsive touch layout with keyboard flex adjustment, bottom user bar, single-slot composer, swipe/drawer navigation, and double-tap voice channel joining.
  - `requestAnimationFrame` mutation coalescing in `src/tauri-bridge/haven-bridge.js`.
- **Compact Android Rust Library (`src-tauri/Cargo.toml`):**
  - Uses LTO size optimization (`opt-level = "z"`, `lto = true`, `codegen-units = 1`, `strip = true`) alongside `tauri.android.conf.json`.

---

## Companion Haven Repositories

- [`haven-desktop`](https://github.com/khanhtg2011/haven-desktop) — Electron Desktop client (`main`)
- [`haven-desktop-tauri`](https://github.com/khanhtg2011/haven-desktop-tauri) — Tauri v2 + WebView2 Desktop client with 240 FPS Win32 GDI+ HUD overlay
- [`haven-native`](https://github.com/khanhtg2011/haven-native) — 100% Pure Rust Slint client (Zero WebView2)

---

## Development & Testing

```powershell
# Install Tauri CLI dependency
npm install --ignore-scripts

# Run mobile UI & bridge verification tests
npm test

# Type-check Rust core
cargo check --manifest-path src-tauri/Cargo.toml

# Build Android APK (requires Android SDK + NDK 27+)
npm run tauri:android:build
```

## License

AGPL-3.0
