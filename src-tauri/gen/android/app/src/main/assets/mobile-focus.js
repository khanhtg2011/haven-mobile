(function () {
  'use strict';

  if (window.__HAVEN_MOBILE_FOCUS_INSTALLED__) {
    if (typeof window.__HAVEN_MOBILE_FOCUS_SYNC__ === 'function') {
      window.__HAVEN_MOBILE_FOCUS_SYNC__();
    }
    return;
  }
  window.__HAVEN_MOBILE_FOCUS_INSTALLED__ = true;

  const CLUTTER_SELECTOR = [
    '#composer-plus-btn', '.btn-composer-plus',
    '#gif-btn', '.btn-gif',
    '#poll-btn', '.btn-poll',
    '#time-btn', '.btn-time',
    '#format-btn', '.btn-format',
    '#voice-btn', '.btn-voice-msg',
    '#self-destruct-btn', '.btn-self-destruct',
    '#silent-btn', '.btn-silent',
    '#highlight-btn', '.btn-highlight',
    '#burn-btn', '.btn-burn',
    '#sb-sidebar-toggle-btn', '.sb-sidebar-toggle-btn',
    '.input-actions-divider', '.pip-input-resizer',
    '.sidebar-bottom-bar', '.braid-more-wrap',
    '#braid-more-btn', '#braid-theme-btn', '#braid-classic-btn',
    '.braid-bar-btn', '#braid-return-pill', '.braid-return-pill', '.braid-return-float',
    '#status-bar-toggle', '.status-bar-toggle-tab', '#status-bar'
  ].join(', ');

  // 1. Suppress browser push-notification prompts immediately
  window.__DISABLE_PUSH_PROMPT__ = true;
  try {
    localStorage.setItem('haven_push_error_dismissed', 'true');
  } catch (_) {}

  if (typeof Notification !== 'undefined') {
    try {
      Notification.requestPermission = () => Promise.resolve('granted');
    } catch (_) {}
  }

  function dismissModals() {
    const pushModal = document.getElementById('push-error-modal');
    if (pushModal) {
      pushModal.style.setProperty('display', 'none', 'important');
      pushModal.style.setProperty('opacity', '0', 'important');
      pushModal.style.setProperty('visibility', 'hidden', 'important');
      const dismissBtn = document.getElementById('push-error-dismiss-btn');
      if (dismissBtn) {
        try { dismissBtn.click(); } catch (_) {}
      }
      pushModal.remove();
    }
    for (const id of ['android-beta-modal', 'desktop-promo-modal', 'android-beta-banner']) {
      const modal = document.getElementById(id);
      if (modal) {
        modal.style.setProperty('display', 'none', 'important');
        modal.remove();
      }
    }

    if (window.app && typeof window.app._showPushError === 'function') {
      window.app._showPushError = function () {};
    }
  }

  const MOBILE_FOCUS_CSS = `
      :root {
        --safe-bottom: env(safe-area-inset-bottom, 0px);
        --safe-top: env(safe-area-inset-top, 0px);
      }

      /* Suppress annoying promo and debug widgets */
      #push-error-modal, #android-beta-modal, #desktop-promo-modal,
      .android-beta-promo, .desktop-promo, #haven-mobile-focus-dock,
      #status-bar-toggle, .status-bar-toggle-tab, #status-bar {
        display: none !important;
        opacity: 0 !important;
        pointer-events: none !important;
        visibility: hidden !important;
      }

      /* Hide desktop-only window controls */
      #titlebar, .window-controls, .desktop-decorations, .sidebar-resize-handle {
        display: none !important;
      }

      /* Top Channel Header */
      .channel-header, #chat-header, .chat-header {
        height: calc(48px + var(--safe-top)) !important;
        min-height: 48px !important;
        padding: var(--safe-top) 10px 0 10px !important;
        background: #2b2d31 !important;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        gap: 6px !important;
      }

      #mobile-menu-btn {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 36px !important;
        height: 36px !important;
        flex-shrink: 0 !important;
        font-size: 26px !important;
        font-weight: 700 !important;
        color: #949ba4 !important;
        background: transparent !important;
        border: none !important;
        cursor: pointer !important;
        line-height: 1 !important;
        padding: 0 !important;
        margin-right: 4px !important;
      }

      .channel-header .mobile-server-dropdown,
      .channel-header #mobile-server-dropdown,
      .channel-header #mobile-server-btn {
        display: none !important;
      }

      .channel-header .channel-info {
        flex: 1 1 auto !important;
        min-width: 0 !important;
      }

      #channel-header-name {
        font-size: 15.5px !important;
        font-weight: 700 !important;
        color: #f2f3f5 !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
      }

      .channel-header .voice-controls {
        display: flex !important;
        align-items: center !important;
        gap: 4px !important;
        flex-shrink: 0 !important;
      }

      #voice-active-indicator {
        max-width: 108px !important;
        padding: 4px 8px !important;
        font-size: 12px !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
      }

      #mobile-users-btn {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 36px !important;
        height: 36px !important;
        flex-shrink: 0 !important;
        color: #949ba4 !important;
        background: transparent !important;
        border: none !important;
      }

      /* Clean Mobile Pill Composer */
      #message-input-area, .message-input-area {
        position: relative !important;
        background: #383a40 !important;
        border-radius: 20px !important;
        border: 1px solid rgba(255, 255, 255, 0.08) !important;
        margin: 6px 10px calc(6px + var(--safe-bottom)) 10px !important;
        padding: 4px 8px !important;
        display: flex !important;
        flex-direction: row !important;
        align-items: center !important;
        gap: 6px !important;
        z-index: 99995 !important;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25) !important;
        box-sizing: border-box !important;
        flex-shrink: 0 !important;
      }

      .input-actions-box {
        display: contents !important;
      }

      /* Single (+) Upload Pill Button */
      #upload-btn, .btn-upload {
        order: 1 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 32px !important;
        height: 32px !important;
        min-width: 32px !important;
        border-radius: 50% !important;
        background: #4e5058 !important;
        color: #dbdee1 !important;
        border: none !important;
        cursor: pointer !important;
        flex-shrink: 0 !important;
        padding: 0 !important;
        margin: 0 !important;
      }
      #upload-btn svg, #upload-btn .upload-icon-clippy { display: none !important; }
      #upload-btn::before {
        content: '+' !important;
        display: block !important;
        font-size: 22px !important;
        font-weight: 600 !important;
        line-height: 1 !important;
        color: #dbdee1 !important;
        margin-top: -2px !important;
      }

      /* Eradicate clutter buttons */
      ${CLUTTER_SELECTOR} {
        display: none !important;
        visibility: hidden !important;
        pointer-events: none !important;
        width: 0 !important;
        height: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        border: none !important;
        opacity: 0 !important;
      }

      /* Text input */
      #message-input, .message-input {
        order: 2 !important;
        flex: 1 1 auto !important;
        min-width: 0 !important;
        width: 100% !important;
        display: block !important;
        background: transparent !important;
        border: none !important;
        color: #f2f3f5 !important;
        font-size: 15px !important;
        padding: 6px 4px !important;
        outline: none !important;
        resize: none !important;
        max-height: 100px !important;
        line-height: 1.35 !important;
        margin: 0 !important;
      }

      /* Emoji Button */
      #emoji-btn, .btn-emoji {
        order: 3 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 32px !important;
        height: 32px !important;
        min-width: 32px !important;
        background: transparent !important;
        color: #b5bac1 !important;
        border: none !important;
        cursor: pointer !important;
        flex-shrink: 0 !important;
        padding: 0 !important;
        margin: 0 !important;
      }
      #emoji-btn svg { width: 22px !important; height: 22px !important; }

      /* Send Button */
      #send-btn, .btn-send {
        order: 4 !important;
        background: #5865F2 !important;
        border-radius: 50% !important;
        width: 32px !important;
        height: 32px !important;
        min-width: 32px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        border: none !important;
        flex-shrink: 0 !important;
        color: #ffffff !important;
        cursor: pointer !important;
        padding: 0 !important;
        margin: 0 !important;
      }
      #send-btn svg { width: 16px !important; height: 16px !important; margin-left: 2px !important; }

      /* Sidebar & User Bar (prevent right-edge button overflow down to 320px viewports) */
      .sidebar-bottom {
        margin-top: auto !important;
        border-top: none !important;
        width: 100% !important;
        max-width: 100% !important;
        box-sizing: border-box !important;
      }

      .user-bar {
        display: flex !important;
        align-items: center !important;
        flex-wrap: nowrap !important;
        width: 100% !important;
        max-width: 100% !important;
        background: #232428 !important;
        padding: 6px 8px !important;
        margin: 0 !important;
        border-top: 1px solid rgba(255, 255, 255, 0.06) !important;
        height: 52px !important;
        box-sizing: border-box !important;
        overflow: hidden !important;
        gap: 3px !important;
      }

      .user-bar .user-bar-avatar {
        width: 32px !important;
        height: 32px !important;
        min-width: 32px !important;
        flex-shrink: 0 !important;
      }

      .user-bar .user-names {
        flex: 1 1 0 !important;
        min-width: 0 !important;
        overflow: hidden !important;
      }

      .user-bar #current-user,
      .user-bar #login-name,
      .user-bar #user-bar-status-text {
        display: block !important;
        max-width: 100% !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        white-space: nowrap !important;
      }

      /* Status text button inside .user-names already opens picker; hide duplicate status dot button on narrow drawers */
      .user-bar #user-status-btn {
        display: none !important;
      }

      .user-bar > .icon-btn,
      .user-bar > #logout-btn,
      .user-bar > #voice-mute-btn,
      .user-bar > #voice-deafen-btn,
      .user-bar > #mobile-settings-btn {
        width: 32px !important;
        height: 32px !important;
        min-width: 32px !important;
        max-width: 32px !important;
        flex: 0 0 32px !important;
        padding: 0 !important;
        margin: 0 !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        font-size: 15px !important;
        border-radius: 8px !important;
        box-sizing: border-box !important;
      }

      /* Keep the bottom user-bar clean and readable on mobile (Mentions/Rename are in Settings/Header) */
      .user-bar > #mentions-btn,
      .user-bar > #rename-btn {
        display: none !important;
      }

      .channel-item {
        border-radius: 8px !important;
        margin: 2px 8px !important;
        padding: 7px 10px !important;
        cursor: pointer !important;
      }

      .channel-item.active {
        background: rgba(255, 255, 255, 0.12) !important;
        color: #ffffff !important;
        font-weight: 600 !important;
      }

      /* Show compact Voice Join button in mobile header for 1-tap voice access */
      .channel-header #voice-join-btn {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        padding: 5px 10px !important;
        font-size: 12px !important;
        font-weight: 600 !important;
        border-radius: 16px !important;
        white-space: nowrap !important;
      }

      /* Cleaner mobile chat messages & media */
      .message, .msg-group {
        padding: 6px 10px !important;
      }
      .message img, .msg-group img {
        border-radius: 10px !important;
        max-width: 100% !important;
        height: auto !important;
      }

      /* Responsive Settings Modal on narrow mobile portrait screens */
      #settings-modal {
        padding: 8px !important;
        box-sizing: border-box !important;
      }

      #settings-modal .modal.modal-settings,
      #settings-modal .modal,
      .settings-modal .modal-content {
        min-width: 0 !important;
        width: calc(100vw - 16px) !important;
        max-width: calc(100vw - 16px) !important;
        max-height: 88dvh !important;
        margin: 0 auto !important;
        overflow-x: hidden !important;
        box-sizing: border-box !important;
      }

      #settings-modal .settings-body,
      #settings-modal .settings-section,
      #settings-modal .settings-row {
        min-width: 0 !important;
        max-width: 100% !important;
        box-sizing: border-box !important;
      }

      #settings-modal .settings-header {
        padding: 12px 14px !important;
        gap: 8px !important;
        flex-wrap: wrap !important;
      }

      #settings-modal .settings-tab-bar,
      #settings-modal .settings-nav {
        display: flex !important;
        flex-wrap: wrap !important;
        overflow-x: visible !important;
        max-width: 100% !important;
        gap: 6px !important;
      }

      #settings-modal .settings-tab-bar::-webkit-scrollbar,
      #settings-modal .settings-nav::-webkit-scrollbar {
        display: none !important;
      }

      #settings-modal .settings-tab,
      #settings-modal .settings-nav-item {
        flex: 0 0 auto !important;
        white-space: nowrap !important;
      }
    `;

  // 2. Inject CSS safely even when executed at document-start before <html> or <head> exists
  function injectStyles() {
    dismissModals();
    const mountTarget = document.head || document.documentElement;
    if (!mountTarget) return false;
    if (!document.getElementById('haven-mobile-focus-styles')) {
      const style = document.createElement('style');
      style.id = 'haven-mobile-focus-styles';
      style.textContent = MOBILE_FOCUS_CSS;
      mountTarget.appendChild(style);
    }
    dismissModals();
    return true;
  }

  // 3. Double click/tap strictly on VOICE channels to directly join voice
  function isVoiceTargetChannel(item) {
    if (!item) return false;
    const code = item.dataset.code;
    if (window.app && Array.isArray(window.app.channels) && code) {
      const ch = window.app.channels.find(c => c && c.code === code);
      if (ch && (ch.type === 'voice' || ch.channel_type === 'voice')) {
        return true;
      }
    }
    if (item.classList.contains('voice-channel') || item.dataset.type === 'voice') {
      return true;
    }
    if (item.querySelector('.channel-voice-indicator')) {
      return true;
    }
    const hash = item.querySelector('.channel-hash');
    return Boolean(hash && hash.textContent && hash.textContent.includes('\u{1F50A}'));
  }

  function triggerVoiceJoin(code) {
    if (!code || !window.app) return;
    if (window.app.voice && window.app.voice.inVoice && window.app.voice.currentChannel === code) {
      return;
    }
    if (window.app.currentChannel !== code) {
      window.app.switchChannel(code);
    }
    setTimeout(() => {
      if (window.app && window.app.voice && window.app.voice.inVoice) return;
      if (window.app && typeof window.app._joinVoice === 'function') {
        window.app._joinVoice();
      } else {
        document.getElementById('voice-join-btn')?.click();
      }
    }, 220);
  }

  document.addEventListener('dblclick', (e) => {
    const item = e.target.closest('.channel-item');
    if (!item) return;
    if (e.target.closest('.channel-more-btn') || e.target.closest('.channel-collapse-arrow')) return;
    if (!isVoiceTargetChannel(item)) return;

    const code = item.dataset.code;
    if (code) {
      triggerVoiceJoin(code);
    }
  }, true);

  let lastTouchTime = 0;
  let lastTouchCode = null;
  let touchStartPos = { x: 0, y: 0 };

  document.addEventListener('touchstart', (e) => {
    if (e.touches && e.touches.length === 1) {
      touchStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    const item = e.target.closest('.channel-item');
    if (!item) return;
    if (e.target.closest('.channel-more-btn') || e.target.closest('.channel-collapse-arrow')) return;

    const touch = e.changedTouches && e.changedTouches[0];
    if (touch) {
      const dx = Math.abs(touch.clientX - touchStartPos.x);
      const dy = Math.abs(touch.clientY - touchStartPos.y);
      if (dx > 12 || dy > 12) return;
    }

    if (!isVoiceTargetChannel(item)) return;

    const code = item.dataset.code;
    if (!code) return;

    const now = Date.now();
    if (lastTouchCode === code && (now - lastTouchTime) >= 80 && (now - lastTouchTime) <= 450) {
      lastTouchTime = 0;
      lastTouchCode = null;
      triggerVoiceJoin(code);
      return;
    }

    lastTouchTime = now;
    lastTouchCode = code;
  }, { passive: true });

  let isSyncing = false;
  let syncScheduled = false;

  function relocateUserBar() {
    if (isSyncing) return;
    isSyncing = true;
    try {
      injectStyles();

      document.querySelectorAll(CLUTTER_SELECTOR).forEach(el => {
        if (el.id !== 'status-bar' && el.id !== 'status-bar-toggle') {
          el.remove();
        } else {
          el.style.setProperty('display', 'none', 'important');
        }
      });

      const sidebar = document.querySelector('.sidebar');
      const userBar = document.querySelector('.user-bar');
      const sidebarBottom = document.querySelector('.sidebar-bottom');

      if (sidebar && userBar && sidebarBottom) {
        if (userBar.parentElement !== sidebarBottom) {
          sidebarBottom.prepend(userBar);
        }

        const muteBtn = document.getElementById('voice-mute-btn');
        const deafenBtn = document.getElementById('voice-deafen-btn');
        const settingsBtn = document.getElementById('mobile-settings-btn') || document.getElementById('open-settings-btn');

        for (const btn of [muteBtn, deafenBtn, settingsBtn]) {
          if (btn && btn.parentElement !== userBar) {
            btn.style.display = 'inline-flex';
            userBar.appendChild(btn);
          }
        }
      }
    } finally {
      isSyncing = false;
    }
  }

  function scheduleSync() {
    if (syncScheduled) return;
    syncScheduled = true;
    const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (cb) => setTimeout(cb, 16);
    raf(() => {
      syncScheduled = false;
      relocateUserBar();
    });
  }

  window.__HAVEN_MOBILE_FOCUS_SYNC__ = scheduleSync;

  function attachObserverAndSync() {
    injectStyles();
    relocateUserBar();
    const observeTarget = document.body || document.documentElement;
    if (!observeTarget) return false;
    if (!window.__HAVEN_MOBILE_FOCUS_OBSERVER__) {
      const observer = new MutationObserver(() => {
        if (!isSyncing) scheduleSync();
      });
      observer.observe(observeTarget, { childList: true, subtree: true });
      window.__HAVEN_MOBILE_FOCUS_OBSERVER__ = observer;
    }
    return true;
  }

  // Initialization (safe at document-start when DOM nodes are still null)
  if (!attachObserverAndSync()) {
    document.addEventListener('DOMContentLoaded', attachObserverAndSync, { once: true });
    window.addEventListener('load', attachObserverAndSync, { once: true });
  }
})();
