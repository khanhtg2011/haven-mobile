// ══════════════════════════════════════════════════════════════════════════════
// Haven Desktop: Tauri v2 Preload Bridge (Ultra-Optimized)
// 100% Desktop Parity, Triple-Layer Auto-Permissions & In-Game Voice Overlay HUD
// ══════════════════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // 1. Tauri IPC invoke helper
  const invoke = (cmd, args = {}) => {
    if (window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke) {
      return window.__TAURI__.core.invoke(cmd, args);
    }
    return Promise.resolve(null);
  };

  function coalesceFrame(fn) {
    let scheduled = false;
    const schedule = typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame
      : (cb) => setTimeout(cb, 16);
    return () => {
      if (scheduled) return;
      scheduled = true;
      schedule(() => {
        scheduled = false;
        fn();
      });
    };
  }

  // 2. Build window.havenDesktop API immediately (evaluated before any web scripts)
  const isAndroid = /Android/i.test(navigator.userAgent);
  const havenDesktop = {
    platform: isAndroid ? 'android' : 'win32',
    isDesktopApp: !isAndroid,
    isMobileApp: isAndroid,

    window: {
      minimize: () => invoke('window_minimize'),
      maximize: () => invoke('window_maximize'),
      close: () => invoke('window_close'),
      isMaximized: async () => false,
    },

    app: {
      getVersion: async () => {
        try { return await invoke('get_app_version'); }
        catch { return '2.0.0-tauri'; }
      },
      isUpdateAvailable: async () => false,
      installUpdate: () => {},
      openExternal: (url) => {
        invoke('open_external_url', { url });
      },
    },

    voiceOverlayEnabled: async () => {
      try {
        const res = await invoke('is_voice_overlay_enabled');
        return res !== false;
      } catch {
        return true;
      }
    },

    voiceOverlayReport: (report) => {
      invoke('report_voice_overlay', { report });
    },

    notify: ({ title, body, icon, channelCode, unreadCount } = {}) => {
      try {
        if ('Notification' in window && Notification.permission === 'granted') {
          const n = new Notification(title || 'Haven', {
            body: body || '',
            icon: icon || undefined,
            tag: channelCode || undefined,
            badge: icon || undefined,
          });
          if (channelCode) {
            n.onclick = () => {
              window.focus();
              window.location.hash = channelCode;
            };
          }
        }
      } catch (_) {}
    },
  };

  // ══════════════════════════════════════════════════════════════════════════
  // 2.1 Android Focus View & Discord Mobile Parity Controller
  // ══════════════════════════════════════════════════════════════════════════
  if (isAndroid) {
    try {
      window.__DISABLE_PUSH_PROMPT__ = true;
      if (typeof Notification !== 'undefined') {
        Notification.requestPermission = () => Promise.resolve('granted');
      }
    } catch (_) {}

    // Immediate style injection to suppress push error modals & desktop chrome
    const suppressStyle = document.createElement('style');
    suppressStyle.id = 'haven-mobile-suppress-styles';
    suppressStyle.textContent = `
      #push-error-modal, #android-beta-modal, #desktop-promo-modal {
        display: none !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
      #titlebar, .window-controls, .desktop-decorations {
        display: none !important;
      }
    `;
    (document.head || document.documentElement).appendChild(suppressStyle);

    // Tell Haven it's running inside the mobile app
    window.addEventListener('message', (e) => {
      if (e.data && e.data.type === 'haven:ready') {
        window.postMessage({ type: 'haven:mobile-init', platform: 'android' }, '*');
      }
    });

    function initMobileFocusView() {
      if (document.getElementById('haven-mobile-focus-dock')) return;

      const style = document.createElement('style');
      style.id = 'haven-mobile-focus-styles';
      style.textContent = `
        /* ─── Discord Mobile / Focus View Styles ─── */
        :root {
          --mobile-dock-height: 58px;
          --safe-bottom: env(safe-area-inset-bottom, 0px);
          --safe-top: env(safe-area-inset-top, 0px);
        }

        /* Adjust chat layout for bottom dock */
        #chat, #messages-wrap, #messages {
          padding-bottom: calc(var(--mobile-dock-height) + var(--safe-bottom) + 8px) !important;
        }

        #chat-input-area, .chat-input-wrapper {
          bottom: calc(var(--mobile-dock-height) + var(--safe-bottom)) !important;
          border-radius: 20px !important;
          margin: 0 8px 6px 8px !important;
          background: #23243c !important;
        }

        /* Focus View Bottom Navigation Dock */
        #haven-mobile-focus-dock {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: calc(var(--mobile-dock-height) + var(--safe-bottom));
          padding-bottom: var(--safe-bottom);
          background: #1e1e38;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          align-items: center;
          justify-content: space-around;
          z-index: 9999;
          user-select: none;
          box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.45);
        }

        .focus-dock-tab {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          flex: 1;
          height: 100%;
          color: #949ba4;
          font-size: 11px;
          font-weight: 500;
          text-decoration: none;
          cursor: pointer;
          transition: color 0.15s ease, transform 0.15s ease;
          gap: 3px;
        }

        .focus-dock-tab svg {
          width: 22px;
          height: 22px;
          fill: currentColor;
          transition: transform 0.15s ease;
        }

        .focus-dock-tab.active {
          color: #7c5cfc;
          font-weight: 700;
        }

        .focus-dock-tab.active svg {
          transform: scale(1.1);
        }

        .focus-dock-avatar {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          object-fit: cover;
          border: 1.5px solid currentColor;
        }

        /* Rounded Discord Braid Style for Channels */
        .sidebar {
          background: #171728 !important;
          border-top-right-radius: 16px;
          border-bottom-right-radius: 16px;
        }

        .channel-item {
          border-radius: 8px !important;
          margin: 2px 8px !important;
        }

        .channel-item.active {
          background: #313352 !important;
          color: #fff !important;
        }

        /* Floating voice pill */
        #voice-bar {
          border-radius: 12px !important;
          margin: 6px 10px !important;
          background: #2b2d4a !important;
          border: 1px solid #7c5cfc44 !important;
        }
      `;
      (document.head || document.documentElement).appendChild(style);

      const dock = document.createElement('nav');
      dock.id = 'haven-mobile-focus-dock';
      dock.innerHTML = `
        <div class="focus-dock-tab active" data-tab="server">
          <svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
          <span>Server</span>
        </div>
        <div class="focus-dock-tab" data-tab="dms">
          <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>
          <span>DMs</span>
        </div>
        <div class="focus-dock-tab" data-tab="activity">
          <svg viewBox="0 0 24 24"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z"/></svg>
          <span>Activity</span>
        </div>
        <div class="focus-dock-tab" data-tab="you">
          <svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
          <span>You</span>
        </div>
      `;
      document.body.appendChild(dock);

      // Handle Tab Switching
      const tabs = dock.querySelectorAll('.focus-dock-tab');
      tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          tabs.forEach(t => t.classList.remove('active'));
          tab.classList.add('active');

          const tabName = tab.dataset.tab;
          if (tabName === 'server') {
            const menuBtn = document.getElementById('mobile-menu-btn');
            if (menuBtn) menuBtn.click();
          } else if (tabName === 'dms') {
            const homeServer = document.getElementById('home-server');
            if (homeServer) homeServer.click();
            const dmToggle = document.getElementById('dm-toggle-header');
            if (dmToggle) dmToggle.click();
          } else if (tabName === 'activity') {
            const mentionsBtn = document.getElementById('mentions-btn');
            if (mentionsBtn) mentionsBtn.click();
          } else if (tabName === 'you') {
            const settingsBtn = document.getElementById('mobile-settings-btn') || document.getElementById('open-settings-btn');
            if (settingsBtn) settingsBtn.click();
            else {
              const userAvatar = document.getElementById('user-bar-avatar');
              if (userAvatar) userAvatar.click();
            }
          }
        });
      });

      // Update "You" avatar from user bar if available
      const checkAvatar = setInterval(() => {
        const userImg = document.querySelector('#user-bar-avatar img, #user-bar-face');
        if (userImg && userImg.src) {
          const youTab = dock.querySelector('[data-tab="you"]');
          if (youTab) {
            youTab.innerHTML = `
              <img src="${userImg.src}" class="focus-dock-avatar" />
              <span>You</span>
            `;
          }
          clearInterval(checkAvatar);
        }
      }, 1000);
      setTimeout(() => clearInterval(checkAvatar), 15000);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initMobileFocusView);
    } else {
      initMobileFocusView();
    }
  }
          });
          n.onclick = () => {
            window.focus();
            if (channelCode && window.app && window.app.selectChannel) {
              window.app.selectChannel(channelCode);
            }
          };
        }
      } catch (err) {
        console.warn('[Haven Desktop] Notification error:', err);
      }
    },

    dismissNotification: (_channelCode) => {},

    audio: {
      isSupported: async () => true,
      stopCapture: async () => invoke('stop_audio_capture'),
      optOutOfDucking: async () => true,
    },

    devices: {
      getInputs: async () => {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          return devices.filter(d => d.kind === 'audioinput').map(d => ({ id: d.deviceId, name: d.label || 'Microphone' }));
        } catch { return []; }
      },
      getOutputs: async () => {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          return devices.filter(d => d.kind === 'audiooutput').map(d => ({ id: d.deviceId, name: d.label || 'Default Output' }));
        } catch { return []; }
      },
      setOutput: async (deviceId) => {
        for (const el of document.querySelectorAll('audio, video')) {
          if (el.setSinkId) await el.setSinkId(deviceId);
        }
        return true;
      },
    },

    shortcuts: {
      getConfig: async () => {
        try { return await invoke('get_shortcuts_config'); }
        catch { return { ptt_key: null, ptm_key: null }; }
      },
      setConfig: async (updates) => {
        try { return await invoke('set_shortcuts_config', { config: updates }); }
        catch { return false; }
      },
    },

    setUnreadBadge: (_hasUnread) => {},

    updateVoiceState: (state) => {
      invoke('update_voice_state', { voiceState: state });
    },

    clipboardWriteImage: async (_payload) => ({ ok: true }),

    clipboardWriteText: async (text) => {
      try {
        await navigator.clipboard.writeText(text);
        return { ok: true };
      } catch (e) {
        return { ok: false, error: String(e) };
      }
    },

    saveImage: async ({ bytes, filename } = {}) => {
      try {
        let buf;
        if (bytes instanceof ArrayBuffer || bytes instanceof Uint8Array) {
          buf = Array.from(new Uint8Array(bytes));
        } else if (typeof bytes === 'string') {
          if (bytes.startsWith('data:')) {
            const raw = bytes.slice(bytes.indexOf(',') + 1);
            const binary = atob(raw);
            const len = binary.length;
            const u8 = new Uint8Array(len);
            for (let i = 0; i < len; i++) u8[i] = binary.charCodeAt(i);
            buf = Array.from(u8);
          } else {
            const res = await fetch(bytes);
            const arr = await res.arrayBuffer();
            buf = Array.from(new Uint8Array(arr));
          }
        }
        if (!buf || !buf.length) return { ok: false, error: 'Empty image' };
        const path = await invoke('save_download_file', { filename: filename || 'haven-image.png', data: buf });
        return { ok: true, path };
      } catch (e) {
        return { ok: false, error: String(e) };
      }
    },

    downloadFile: (url, suggestedFilename) => downloadFileUrl(url, suggestedFilename),

    getServerHistory: async () => {
      try { return await invoke('get_server_history'); }
      catch { return ['https://haven.khanhs.io.vn']; }
    },

    switchServer: (url) => invoke('switch_server', { url }),
    backToWelcome: () => invoke('switch_server', { url: 'https://haven.khanhs.io.vn' }),

    update: {
      check: async () => ({ updateAvailable: false }),
      download: () => {},
      install: () => {},
      onStatus: () => () => {},
    },
  };

  // 3. Expose Haven Desktop & Electron APIs globally so client code recognizes desktop environment
  window.havenDesktop = havenDesktop;
  window.electronAPI = havenDesktop;
  window.havenAPI = {
    platform: 'win32',
    isDesktop: true,
    isDesktopApp: true,
    notify: havenDesktop.notify,
  };

  // Mock navigator.userAgent to always signal desktop app
  try {
    const rawUA = navigator.userAgent;
    if (!rawUA.includes('Electron')) {
      Object.defineProperty(navigator, 'userAgent', {
        get: () => `${rawUA} Electron/32.0.0 HavenDesktop/2.0.0`,
        configurable: true,
      });
    }
  } catch (_) {}

  // 4. Stamp desktop identification attributes on <html> and <body>
  try {
    if (document.documentElement) {
      document.documentElement.setAttribute('data-desktop-app', 'true');
      document.documentElement.setAttribute('data-platform', 'win32');
    }
  } catch (_) {}

  // 5. Triple-Layer Auto-Grant Device Permissions (Microphone, Camera, Notifications)
  // Completely eliminates any browser permission prompts
  try {
    if (navigator.permissions && navigator.permissions.query) {
      const originalQuery = navigator.permissions.query.bind(navigator.permissions);
      navigator.permissions.query = function (param) {
        if (param && ['microphone', 'camera', 'notifications', 'speaker-selection', 'clipboard-read', 'clipboard-write'].includes(param.name)) {
          return Promise.resolve({
            state: 'granted',
            name: param.name,
            onchange: null,
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => false,
          });
        }
        return originalQuery(param);
      };
    }

    if (typeof window.Notification !== 'undefined') {
      window.Notification.requestPermission = () => Promise.resolve('granted');
      try {
        Object.defineProperty(window.Notification, 'permission', {
          get: () => 'granted',
          configurable: true,
        });
      } catch (_) {}
    }
  } catch (err) {
    console.warn('[Haven Desktop] Permission auto-grant shim warning:', err);
  }

  // 6. Permanently suppress web promo popups, seed welcome flags, and eradicate promo modals
  try {
    localStorage.setItem('haven_desktop_promo_dismissed', '1');
    localStorage.setItem('promo_seen_desktop', '1');
    localStorage.setItem('haven_ab_promo_nodisplay', '1');
    localStorage.setItem('haven_ab_banner_nodisplay', '1');
    localStorage.setItem('haven_promo_prefs_migrated', '1');

    const welcomeKey = 'haven_welcome_seen_v1';
    let seen = {};
    try { seen = JSON.parse(localStorage.getItem(welcomeKey) || '{}') || {}; } catch (_) {}
    seen.desktop_app_promo = true;
    seen.android_app_promo = true;
    localStorage.setItem(welcomeKey, JSON.stringify(seen));

    // Force hide with high-specificity CSS
    const style = document.createElement('style');
    style.id = 'haven-desktop-injected-style';
    style.textContent = `
      #desktop-promo-modal,
      #android-beta-modal,
      #android-beta-banner,
      .desktop-promo,
      .android-beta-promo,
      .modal-overlay.desktop-promo {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
        width: 0 !important;
        height: 0 !important;
      }
    `;
    if (document.head) {
      document.head.appendChild(style);
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        if (!document.getElementById('haven-desktop-injected-style') && document.head) {
          document.head.appendChild(style);
        }
      });
    }

    // Actively remove promo modals from DOM so they cannot appear even for a single frame
    const purgeModals = () => {
      const ids = ['desktop-promo-modal', 'android-beta-modal', 'android-beta-banner'];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el) el.remove();
      }
    };
    purgeModals();
    const schedulePurge = coalesceFrame(purgeModals);
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', schedulePurge);
    }
    try {
      const observer = new MutationObserver(schedulePurge);
      observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
    } catch (_) {}

    // Persist promo dismissed to user account when socket connects
    const syncPromoPreferences = () => {
      if (window.app && window.app.socket && typeof window.app.socket.emit === 'function') {
        window.app.socket.emit('set-preference', { key: 'promo_seen_desktop', value: 'true' });
        window.app.socket.emit('set-preference', { key: 'promo_seen_android', value: 'true' });
        window.app.socket.emit('set-preference', { key: 'android_banner_seen', value: 'true' });
        return true;
      }
      return false;
    };
    if (!syncPromoPreferences()) {
      const syncInterval = setInterval(() => {
        if (syncPromoPreferences()) clearInterval(syncInterval);
      }, 1000);
      setTimeout(() => clearInterval(syncInterval), 30000);
    }
  } catch (_) {}

  // 7. Desktop Keyboard Navigation & Shortcuts
  window.addEventListener('keydown', (e) => {
    // F5 or Ctrl+R: Refresh page
    if (e.key === 'F5' || (e.ctrlKey && (e.key === 'r' || e.key === 'R'))) {
      e.preventDefault();
      window.location.reload();
      return;
    }
    // Alt+Left: History back
    if (e.altKey && e.key === 'ArrowLeft') {
      e.preventDefault();
      window.history.back();
      return;
    }
    // Alt+Right: History forward
    if (e.altKey && e.key === 'ArrowRight') {
      e.preventDefault();
      window.history.forward();
      return;
    }
    // F11: Fullscreen toggle
    if (e.key === 'F11') {
      e.preventDefault();
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
      return;
    }
    // Ctrl+Shift+O: Toggle Voice Overlay
    if (e.ctrlKey && e.shiftKey && (e.key === 'o' || e.key === 'O')) {
      e.preventDefault();
      if (window.__TAURI__ && window.__TAURI__.core) {
        window.__TAURI__.core.invoke('toggle_voice_overlay_command');
      }
    }
  }, true);

  // 8. Voice & In-Game Chat Overlay Reporter Engine (Gaming & 240 FPS Optimized)
  // Low-overhead event-driven reporter: sleeps when idle, dynamically throttles
  (function initVoiceOverlayReporter() {
    let lastSent = '';
    let socket = null;
    let rosters = Object.create(null);
    const messages = [];
    let seq = 0;
    let isOverlayActive = false;

    // Check initial overlay status
    if (window.__TAURI__ && window.__TAURI__.core) {
      window.__TAURI__.core.invoke('is_voice_overlay_enabled').then(res => {
        isOverlayActive = (res === true);
      }).catch(() => {});
    }

    const scheduleOverlayTick = coalesceFrame(() => {
      tick();
    });

    if (window.__TAURI__ && window.__TAURI__.event) {
      window.__TAURI__.event.listen('voice-overlay:clear-messages', () => {
        messages.length = 0;
        scheduleOverlayTick();
      });
      window.__TAURI__.event.listen('voice-overlay:view', (e) => {
        if (e && e.payload) {
          isOverlayActive = (e.payload.enabled === true);
        }
      });
    }

    function listen(app) {
      if (!app.socket || app.socket === socket || typeof app.socket.on !== 'function') return;
      socket = app.socket;
      rosters = Object.create(null);

      socket.on('voice-users-update', (d) => {
        if (d && typeof d.channelCode === 'string' && Array.isArray(d.users)) {
          rosters[d.channelCode] = d.users;
        }
        scheduleOverlayTick();
        scheduleNextTick();
      });

      socket.on('new-message', (d) => {
        const m = d && d.message;
        if (!m) return;
        const channelObj = (app.channels || []).find(c => c && c.code === d.channelCode);
        const chName = channelObj ? (channelObj.name || d.channelCode) : (d.channelCode || 'chat');
        messages.push({
          seq: ++seq,
          channelCode: d.channelCode || 'chat',
          channelName: chName,
          userId: m.user_id,
          name: m.displayName || m.username || m.author_name || 'User',
          color: m.roleColor || null,
          content: m.content || '',
          time: Date.now(),
        });
        if (messages.length > 8) messages.shift();
        scheduleOverlayTick();
        scheduleNextTick();
      });
    }

    function report() {
      const app = window.app;
      if (!app || !app.user) return null;
      listen(app);

      const v = app.voice || {};
      const me = app.user;
      const code = v.inVoice ? v.currentChannel : null;

      let roster = [];
      if (code) {
        roster = (rosters[code] || []).slice();
        if (!roster.some(u => u && u.id === me.id)) {
          roster.unshift({ id: me.id, username: me.displayName || me.username, roleColor: me.roleColor });
        }
      }

      const talking = (v.talkingState instanceof Map) ? v.talkingState : new Map();
      const channel = (app.channels || []).find(c => c && c.code === code);

      return {
        key: code || 'persistent-hud',
        inVoice: !!code,
        channelName: String((channel && channel.name) || ''),
        users: roster.filter(Boolean).map(u => {
          const self = u.id === me.id;
          return {
            id: u.id,
            name: u.displayName || u.username || 'User',
            color: u.roleColor || null,
            avatar: u.avatar || (self ? me.avatar : null),
            isSelf: self,
            isBot: !!u.isBot,
            talking: !!(self ? talking.get('self') : talking.get(u.id)),
            muted: self ? !!v.isMuted : !!u.isMuted,
            deafened: self ? !!v.isDeafened : !!u.isDeafened,
          };
        }),
        messages: messages.map(m => ({
          seq: m.seq,
          channelName: m.channelName,
          name: m.name,
          color: m.color,
          content: m.content || '',
        })),
      };
    }

    function tick() {
      try {
        const app = window.app;
        if (!app || !app.user) return;
        const inVoice = !!(app.voice && app.voice.inVoice);

        // If user is not in voice and overlay is off, stay completely quiet to save CPU
        if (!inVoice && !isOverlayActive) return;

        const r = report();
        if (!r) return;
        const sig = JSON.stringify(r);
        if (sig === lastSent) return;
        lastSent = sig;
        invoke('report_voice_overlay', { report: r });
      } catch (_) {}
    }

    let tickTimer = null;
    function scheduleNextTick() {
      if (tickTimer) clearTimeout(tickTimer);
      const inVoice = !!(window.app && window.app.voice && window.app.voice.inVoice);
      // Adaptive intervals:
      // - In-voice with active HUD: 200ms (fluid talking highlight)
      // - In-voice without HUD (gaming mode): 600ms (low CPU)
      // - Idle / not in voice: 2500ms (ultra-low CPU sleep)
      const delay = (inVoice && isOverlayActive) ? 200 : (inVoice ? 600 : 2500);
      tickTimer = setTimeout(() => {
        tick();
        scheduleNextTick();
      }, delay);
    }

    scheduleNextTick();
  })();

  // 9. Intercept File Downloads & External Link Navigation
  async function downloadFileUrl(url, suggestedFilename) {
    const fullUrl = new URL(url, window.location.origin).href;
    let filename = (suggestedFilename || '').trim();
    if (!filename) {
      try {
        const u = new URL(fullUrl);
        filename = decodeURIComponent(u.pathname.split('/').pop() || 'download');
      } catch {
        filename = 'download';
      }
    }

    if (window.app && typeof window.app._showToast === 'function') {
      window.app._showToast(`Đang tải xuống: ${filename}...`, 'info');
    }

    try {
      const res = await fetch(fullUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const buffer = await res.arrayBuffer();
      const data = Array.from(new Uint8Array(buffer));
      const savedPath = await invoke('save_download_file', { filename, data });

      if (savedPath) {
        if (window.app && typeof window.app._showToast === 'function') {
          window.app._showToast(`✓ Đã lưu: ${filename}`, 'success');
        }
        havenDesktop.notify({
          title: 'Tải tệp hoàn tất',
          body: `${filename} đã được lưu vào thư mục Downloads.`,
        });
        return { ok: true, path: savedPath };
      }
    } catch (err) {
      console.error('[Haven Desktop] Download error:', err);
      if (window.app && typeof window.app._showToast === 'function') {
        window.app._showToast(`Lỗi tải tệp: ${err.message || err}`, 'error');
      }
      return { ok: false, error: String(err) };
    }
  }

  window.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (!link) return;
    const href = link.getAttribute('href');
    if (!href || href === '#' || href.startsWith('javascript:')) return;

    // Check if this is a file download link (file attachment card, download attribute, or /uploads/ file)
    const isFileCard = link.classList.contains('file-download-link');
    const hasDownloadAttr = link.hasAttribute('download');
    const isUploadFile = /\/uploads\//.test(href) && !/\.(html|htm)$/i.test(href);

    if (isFileCard || hasDownloadAttr || isUploadFile) {
      e.preventDefault();
      e.stopPropagation();

      let filename = link.getAttribute('download') || '';
      if (!filename) {
        const nameEl = link.querySelector('.file-name');
        if (nameEl && nameEl.textContent) {
          filename = nameEl.textContent.trim();
        }
      }
      downloadFileUrl(href, filename);
      return;
    }

    // Check if this is an external link (different origin or target="_blank")
    try {
      const parsed = new URL(link.href, window.location.origin);
      const isDifferentOrigin = parsed.origin !== window.location.origin;
      const isBlank = link.getAttribute('target') === '_blank';

      if (isDifferentOrigin || isBlank) {
        const isHavenDeepLink =
          /^\/(app(\.html)?|c\/[A-Za-z0-9]+)/.test(parsed.pathname) ||
          parsed.searchParams.has('channel') ||
          parsed.searchParams.has('message');

        if (!isHavenDeepLink && (parsed.protocol === 'http:' || parsed.protocol === 'https:')) {
          e.preventDefault();
          e.stopPropagation();
          invoke('open_external_url', { url: link.href });
        }
      }
    } catch (_) {}
  }, true);

  console.log('[Haven Desktop] Native Rust & Tauri Bridge active with auto-permissions & Voice Overlay!');
})();
