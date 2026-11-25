// ══════════════════════════════════════════════════════════════════════════════
// Haven Desktop: Tauri v2 Preload Bridge (Ultra-Optimized)
// 100% Desktop Parity, Triple-Layer Auto-Permissions & In-Game Voice Overlay HUD
// ══════════════════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  if (window.__HAVEN_TAURI_BRIDGE_INITIALIZED__) return;
  window.__HAVEN_TAURI_BRIDGE_INITIALIZED__ = true;

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
      if (isAndroid) return false;
      try {
        const res = await invoke('is_voice_overlay_enabled');
        return res !== false;
      } catch {
        return true;
      }
    },

    voiceOverlayReport: (report) => {
      if (!isAndroid) {
        invoke('report_voice_overlay', { report });
      }
    },

    notify: ({ title, body, icon, channelCode, unreadCount: _unreadCount } = {}) => {
      try {
        if ('Notification' in window && Notification.permission === 'granted') {
          const n = new Notification(title || 'Haven', {
            body: body || '',
            icon: icon || undefined,
            tag: channelCode || undefined,
            badge: icon || undefined,
          });
          n.onclick = () => {
            window.focus();
            if (channelCode && window.app && window.app.selectChannel) {
              window.app.selectChannel(channelCode);
            } else if (channelCode) {
              window.location.hash = channelCode;
            }
          };
        }
      } catch (err) {
        console.warn('[Haven Bridge] Notification error:', err);
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

  // 3. Expose platform-accurate Haven Tauri Bridge APIs
  window.havenDesktop = havenDesktop;
  window.electronAPI = isAndroid ? undefined : havenDesktop;
  window.havenAPI = {
    platform: isAndroid ? 'android' : 'win32',
    isDesktop: !isAndroid,
    isDesktopApp: !isAndroid,
    isMobileApp: isAndroid,
    notify: havenDesktop.notify,
  };

  if (!isAndroid) {
    try {
      const rawUA = navigator.userAgent;
      if (!rawUA.includes('Electron')) {
        Object.defineProperty(navigator, 'userAgent', {
          get: () => `${rawUA} Electron/32.0.0 HavenDesktop/2.0.0`,
          configurable: true,
        });
      }
    } catch (_) {}
  }

  // 4. Stamp identification attributes on <html> once available
  const stampPlatformAttrs = () => {
    try {
      if (!document.documentElement) return;
      document.documentElement.setAttribute(isAndroid ? 'data-mobile-app' : 'data-desktop-app', 'true');
      document.documentElement.setAttribute('data-platform', isAndroid ? 'android' : 'win32');
    } catch (_) {}
  };
  stampPlatformAttrs();
  if (!document.documentElement) {
    document.addEventListener('DOMContentLoaded', stampPlatformAttrs, { once: true });
  }

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

    // Skip injecting a duplicate style sheet when mobile-focus styles already cover promo hiding
    const ensurePromoStyle = () => {
      if (isAndroid && document.getElementById('haven-mobile-focus-styles')) return;
      if (document.getElementById('haven-desktop-injected-style') || !document.head) return;
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
      document.head.appendChild(style);
    };
    if (document.head) {
      ensurePromoStyle();
    } else {
      document.addEventListener('DOMContentLoaded', ensurePromoStyle, { once: true });
    }

    // Actively remove promo modals from DOM so they cannot appear even for a single frame
    const PROMO_MODAL_SET = new Set(['desktop-promo-modal', 'android-beta-modal', 'android-beta-banner']);
    const purgeModals = () => {
      for (const id of PROMO_MODAL_SET) {
        const el = document.getElementById(id);
        if (el) el.remove();
      }
    };
    purgeModals();
    const requestPurgeFrame = coalesceFrame(purgeModals);
    const schedulePurge = (mutations) => {
      if (!Array.isArray(mutations)) {
        requestPurgeFrame();
        return;
      }
      for (let i = 0; i < mutations.length; i++) {
        const added = mutations[i].addedNodes;
        if (!added || added.length === 0) continue;
        for (let j = 0; j < added.length; j++) {
          const node = added[j];
          if (!node || node.nodeType !== 1) continue;
          if (PROMO_MODAL_SET.has(node.id)) {
            requestPurgeFrame();
            return;
          }
          if (node.firstElementChild && node.id !== 'messages' && typeof node.querySelector === 'function') {
            if (node.querySelector('#desktop-promo-modal, #android-beta-modal, #android-beta-banner')) {
              requestPurgeFrame();
              return;
            }
          }
        }
      }
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', requestPurgeFrame, { once: true });
    }
    const attachPurgeObserver = () => {
      try {
        const target = document.body || document.documentElement;
        if (!target) return false;
        const observer = new MutationObserver(schedulePurge);
        observer.observe(target, { childList: true, subtree: true });
        return true;
      } catch (_) {
        return false;
      }
    };
    if (!attachPurgeObserver()) {
      document.addEventListener('DOMContentLoaded', attachPurgeObserver, { once: true });
    }

    // Persist promo dismissed to user account once (avoid 1Hz polling on repeat launches)
    const syncPromoPreferences = () => {
      if (window.app && window.app.socket && typeof window.app.socket.emit === 'function') {
        window.app.socket.emit('set-preference', { key: 'promo_seen_desktop', value: 'true' });
        window.app.socket.emit('set-preference', { key: 'promo_seen_android', value: 'true' });
        window.app.socket.emit('set-preference', { key: 'android_banner_seen', value: 'true' });
        try { localStorage.setItem('haven_promo_prefs_synced', '1'); } catch (_) {}
        return true;
      }
      return false;
    };
    if (localStorage.getItem('haven_promo_prefs_synced') !== '1' && !syncPromoPreferences()) {
      const delays = [1500, 3000, 6000, 10000];
      let step = 0;
      const tryLater = () => {
        if (syncPromoPreferences() || step >= delays.length) return;
        setTimeout(tryLater, delays[step++]);
      };
      setTimeout(tryLater, delays[step++]);
    }
  } catch (_) {}

  // 7. Desktop Keyboard Navigation & Shortcuts (skipped on Android)
  if (!isAndroid) {
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
  }

  // 8. Voice & In-Game Chat Overlay Reporter Engine (Desktop-only; sleeps on Android)
  (function initVoiceOverlayReporter() {
    if (isAndroid) return;
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
    const target = e.target;
    if (!target || typeof target.closest !== 'function') return;
    const link = target.closest('a');
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
