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

  const PROMO_MODAL_IDS = ['android-beta-modal', 'desktop-promo-modal', 'android-beta-banner'];
  const CHAT_FEED_SELECTOR = '#messages, #dm-pip-messages, #thread-messages, .typing-indicator';

  const SYNC_MODALS = 1 << 0;
  const SYNC_CLUTTER = 1 << 1;
  const SYNC_SIDEBAR = 1 << 2;
  const SYNC_MEDIA = 1 << 3;
  const SYNC_ALL = SYNC_MODALS | SYNC_CLUTTER | SYNC_SIDEBAR | SYNC_MEDIA;

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

  let modalsCleanOnce = false;
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
    for (let i = 0; i < PROMO_MODAL_IDS.length; i++) {
      const modal = document.getElementById(PROMO_MODAL_IDS[i]);
      if (modal) {
        modal.style.setProperty('display', 'none', 'important');
        modal.remove();
      }
    }

    if (window.app && typeof window.app._showPushError === 'function' && !window.app.__havenPushPatched) {
      window.app._showPushError = function () {};
      window.app.__havenPushPatched = true;
    }
    modalsCleanOnce = true;
  }

  const MOBILE_FOCUS_CSS = `
      :root {
        --safe-bottom: env(safe-area-inset-bottom, 0px);
        --safe-top: env(safe-area-inset-top, 0px);
        --msg-glow: none !important;
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

      /* Mobile GPU Performance: Eliminate offscreen backdrop-filter blur readbacks */
      .modal-overlay {
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
        background: rgba(0, 0, 0, 0.72) !important;
        contain: layout style !important;
      }

      .pins-pip-header, .dm-pip-header, .dm-pip-input-area,
      .profile-popup, .toast, .stream-viewer-badge,
      .fullscreen-call-toolbar:not([hidden]),
      .main.banner-mode-shaded .header-actions-box,
      .main.banner-mode-minimal .channel-info,
      .main.banner-mode-minimal .header-actions-box,
      .main.banner-mode-minimal .btn-voice,
      .main.banner-mode-minimal .voice-active-indicator,
      .main.banner-mode-minimal .channel-topic-bar {
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
      }

      /* Stop continuous infinite idle keyframe animations on mobile */
      .tp-preview, .update-pulse, .disk-low-dot, .donors-heart-icon {
        animation: none !important;
      }

      /* Instant touch response without 300ms delay or grey highlight flash */
      button, a, input, textarea, [role="button"], .channel-item {
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
      }

      /* Avoid layout-invalidating transition:all on high-frequency interactive controls */
      .channel-item, .message, .msg-group, .modal, .settings-nav-item, .tp-card {
        transition-property: background-color, border-color, color, opacity, transform !important;
        transition-duration: 0.12s !important;
      }

      /* Hardware-accelerated mobile sidebar drawer and momentum scrolling */
      .sidebar {
        will-change: transform;
        backface-visibility: hidden;
        contain: layout style;
      }

      #channel-list, #member-list {
        contain: layout style;
        overscroll-behavior-y: contain;
        -webkit-overflow-scrolling: touch;
      }

      /* Top Channel Header */
      .channel-header, #chat-header, .chat-header {
        height: calc(52px + var(--safe-top)) !important;
        min-height: 52px !important;
        padding: var(--safe-top) 12px 0 12px !important;
        background: #2b2d31 !important;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        gap: 8px !important;
        contain: layout style;
      }

      #mobile-menu-btn {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 38px !important;
        height: 38px !important;
        flex-shrink: 0 !important;
        font-size: 26px !important;
        font-weight: 700 !important;
        color: #b5bac1 !important;
        background: transparent !important;
        border: none !important;
        border-radius: 10px !important;
        cursor: pointer !important;
        line-height: 1 !important;
        padding: 0 !important;
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
        font-size: 16px !important;
        font-weight: 700 !important;
        color: #f2f3f5 !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
      }

      .channel-header .voice-controls {
        display: flex !important;
        align-items: center !important;
        gap: 6px !important;
        flex-shrink: 0 !important;
      }

      #voice-active-indicator {
        max-width: 112px !important;
        padding: 5px 10px !important;
        border-radius: 999px !important;
        font-size: 12px !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
      }

      #mobile-users-btn {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 38px !important;
        height: 38px !important;
        flex-shrink: 0 !important;
        color: #b5bac1 !important;
        background: transparent !important;
        border: none !important;
        border-radius: 10px !important;
      }

      /* Chat Messages & Media: layout/style isolation for fast scrolling */
      #messages, #messages-container, .messages-container, #dm-pip-messages, #thread-messages {
        padding: 8px 6px !important;
        contain: layout style;
        overflow-anchor: auto;
        overscroll-behavior-y: contain;
        -webkit-overflow-scrolling: touch;
      }

      .message, .msg-group {
        border-radius: 12px !important;
        padding: 6px 10px !important;
        margin-bottom: 4px !important;
        contain: layout style;
        content-visibility: auto;
        contain-intrinsic-size: auto 64px;
      }

      .message:hover, .msg-group:hover {
        transition: none !important;
        box-shadow: none !important;
      }

      .message img:not(.message-avatar-img):not(.custom-emoji):not(.emoji):not(.reaction-custom-emoji),
      .message video,
      .msg-group img:not(.message-avatar-img):not(.custom-emoji):not(.emoji):not(.reaction-custom-emoji),
      .msg-attachment img {
        max-width: 100% !important;
        height: auto !important;
        border-radius: 10px !important;
      }

      .message-avatar-img {
        width: var(--msg-avatar, 38px) !important;
        height: var(--msg-avatar, 38px) !important;
        min-width: var(--msg-avatar, 38px) !important;
        border-radius: 50% !important;
        object-fit: cover !important;
        align-self: flex-start !important;
      }

      /* Clean Mobile Pill Composer */
      #message-input-area, .message-input-area {
        position: relative !important;
        background: #383a40 !important;
        border-radius: 24px !important;
        border: 1px solid rgba(255, 255, 255, 0.08) !important;
        margin: 6px 10px calc(8px + var(--safe-bottom)) 10px !important;
        padding: 5px 8px !important;
        display: flex !important;
        flex-direction: row !important;
        align-items: center !important;
        gap: 6px !important;
        z-index: 99995 !important;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.28) !important;
        box-sizing: border-box !important;
        flex-shrink: 0 !important;
        contain: layout style;
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
        min-height: 44px !important;
        border-radius: 10px !important;
        margin: 3px 8px !important;
        padding: 9px 12px !important;
        font-size: 15px !important;
        cursor: pointer !important;
        contain: layout style;
      }

      .channel-item.active {
        background: rgba(88, 101, 242, 0.22) !important;
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

      /* Full-screen Native-style Settings Sheet on Mobile */
      #settings-modal {
        padding: 0 !important;
        box-sizing: border-box !important;
      }

      #settings-modal .modal.modal-settings,
      #settings-modal .modal,
      .settings-modal .modal-content {
        min-width: 0 !important;
        width: 100vw !important;
        max-width: 100vw !important;
        height: 100dvh !important;
        max-height: 100dvh !important;
        margin: 0 !important;
        border-radius: 0 !important;
        border: none !important;
        overflow-x: hidden !important;
        box-sizing: border-box !important;
        contain: layout style !important;
      }

      #settings-modal .settings-body,
      #settings-modal .settings-section,
      #settings-modal .settings-row {
        min-width: 0 !important;
        max-width: 100% !important;
        box-sizing: border-box !important;
      }

      #settings-modal .settings-body {
        contain: layout style;
        overscroll-behavior-y: contain;
        -webkit-overflow-scrolling: touch;
      }

      #settings-modal .settings-section,
      #settings-modal .tp-card {
        contain: layout style;
        content-visibility: auto;
        contain-intrinsic-size: auto 120px;
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

  let styleEl = null;
  function ensureStyleElement() {
    if (styleEl && styleEl.isConnected) return true;
    const existing = document.getElementById('haven-mobile-focus-styles');
    if (existing) {
      styleEl = existing;
      return true;
    }
    const mountTarget = document.head || document.documentElement;
    if (!mountTarget) return false;
    const style = document.createElement('style');
    style.id = 'haven-mobile-focus-styles';
    style.textContent = MOBILE_FOCUS_CSS;
    mountTarget.appendChild(style);
    styleEl = style;
    return true;
  }

  // 2. Inject CSS safely even when executed at document-start before <html> or <head> exists
  function injectStyles() {
    const ok = ensureStyleElement();
    if (!ok) return false;
    if (!modalsCleanOnce) dismissModals();
    return true;
  }

  function optimizeMediaInSubtree(root) {
    if (!root || root.nodeType !== 1) return;
    if (root.tagName === 'IMG') {
      if (root.decoding !== 'async') root.decoding = 'async';
      return;
    }
    if (root.tagName === 'VIDEO') {
      if (root.preload === 'auto' || !root.preload) root.preload = 'metadata';
      return;
    }
    if (typeof root.querySelectorAll !== 'function') return;
    const imgs = root.querySelectorAll('img');
    for (let i = 0; i < imgs.length; i++) {
      if (imgs[i].decoding !== 'async') imgs[i].decoding = 'async';
    }
    const videos = root.querySelectorAll('video');
    for (let i = 0; i < videos.length; i++) {
      if (videos[i].preload === 'auto' || !videos[i].preload) videos[i].preload = 'metadata';
    }
  }

  function purgeClutterNode(el) {
    if (!el) return;
    if (el.id !== 'status-bar' && el.id !== 'status-bar-toggle') {
      el.remove();
    } else {
      el.style.setProperty('display', 'none', 'important');
    }
  }

  function purgeClutterInSubtree(root) {
    if (!root || root.nodeType !== 1) return;
    if (typeof root.matches === 'function' && root.matches(CLUTTER_SELECTOR)) {
      purgeClutterNode(root);
      return;
    }
    if (typeof root.querySelectorAll !== 'function') return;
    const list = root.querySelectorAll(CLUTTER_SELECTOR);
    for (let i = 0; i < list.length; i++) {
      purgeClutterNode(list[i]);
    }
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
    const target = e.target;
    if (!target || typeof target.closest !== 'function') return;
    const item = target.closest('.channel-item');
    if (!item) return;
    if (target.closest('.channel-more-btn') || target.closest('.channel-collapse-arrow')) return;
    if (!isVoiceTargetChannel(item)) return;

    const code = item.dataset.code;
    if (code) {
      triggerVoiceJoin(code);
    }
  }, true);

  let lastTouchTime = 0;
  let lastTouchCode = null;
  let touchStartX = 0;
  let touchStartY = 0;

  document.addEventListener('touchstart', (e) => {
    if (e.touches && e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    const target = e.target;
    if (!target || typeof target.closest !== 'function') return;
    const item = target.closest('.channel-item');
    if (!item) return;
    if (target.closest('.channel-more-btn') || target.closest('.channel-collapse-arrow')) return;

    const touch = e.changedTouches && e.changedTouches[0];
    if (touch) {
      const dx = Math.abs(touch.clientX - touchStartX);
      const dy = Math.abs(touch.clientY - touchStartY);
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
  let pendingReasons = 0;
  let fullClutterSweepDone = false;
  const pendingClutterRoots = new Set();
  const pendingMediaRoots = new Set();

  let cachedUserBar = null;
  let cachedSidebarBottom = null;
  let cachedMuteBtn = null;
  let cachedDeafenBtn = null;
  let cachedSettingsBtn = null;

  function resolveUserBarButtons() {
    if (!cachedMuteBtn || !cachedMuteBtn.isConnected) {
      cachedMuteBtn = document.getElementById('voice-mute-btn');
    }
    if (!cachedDeafenBtn || !cachedDeafenBtn.isConnected) {
      cachedDeafenBtn = document.getElementById('voice-deafen-btn');
    }
    if (!cachedSettingsBtn || !cachedSettingsBtn.isConnected) {
      cachedSettingsBtn = document.getElementById('mobile-settings-btn') || document.getElementById('open-settings-btn');
    }
    return [cachedMuteBtn, cachedDeafenBtn, cachedSettingsBtn];
  }

  function isUserBarWiringComplete() {
    if (!cachedUserBar || !cachedUserBar.isConnected) return false;
    if (!cachedSidebarBottom || !cachedSidebarBottom.isConnected) return false;
    if (cachedUserBar.parentElement !== cachedSidebarBottom) return false;

    const buttons = resolveUserBarButtons();
    for (let i = 0; i < buttons.length; i++) {
      if (buttons[i] && buttons[i].parentElement !== cachedUserBar) return false;
    }
    return true;
  }

  function syncSidebarUserBar() {
    if (isUserBarWiringComplete()) return;

    const sidebar = document.querySelector('.sidebar');
    const userBar = document.querySelector('.user-bar');
    const sidebarBottom = document.querySelector('.sidebar-bottom');

    cachedUserBar = userBar;
    cachedSidebarBottom = sidebarBottom;

    if (sidebar && userBar && sidebarBottom) {
      if (userBar.parentElement !== sidebarBottom) {
        sidebarBottom.prepend(userBar);
      }

      const buttons = resolveUserBarButtons();
      for (let i = 0; i < buttons.length; i++) {
        const btn = buttons[i];
        if (btn && btn.parentElement !== userBar) {
          btn.style.display = 'inline-flex';
          userBar.appendChild(btn);
        }
      }
    }
  }

  function relocateUserBar(reasons = SYNC_ALL) {
    if (isSyncing) return;
    isSyncing = true;
    try {
      ensureStyleElement();

      if (reasons & SYNC_MODALS) {
        dismissModals();
      }

      if (reasons & SYNC_CLUTTER) {
        if (!fullClutterSweepDone) {
          const list = document.querySelectorAll(CLUTTER_SELECTOR);
          for (let i = 0; i < list.length; i++) {
            purgeClutterNode(list[i]);
          }
          fullClutterSweepDone = Boolean(document.body);
          pendingClutterRoots.clear();
        } else if (pendingClutterRoots.size > 0) {
          for (const root of pendingClutterRoots) {
            if (root && root.isConnected) {
              purgeClutterInSubtree(root);
            }
          }
          pendingClutterRoots.clear();
        }
      }

      if (reasons & SYNC_SIDEBAR) {
        syncSidebarUserBar();
      }

      if (reasons & SYNC_MEDIA) {
        if (pendingMediaRoots.size > 0) {
          for (const root of pendingMediaRoots) {
            if (root && root.isConnected) {
              optimizeMediaInSubtree(root);
            }
          }
          pendingMediaRoots.clear();
        } else if (document.body) {
          optimizeMediaInSubtree(document.body);
        }
      }
    } finally {
      isSyncing = false;
    }
  }

  function scheduleSync(reasons = SYNC_ALL) {
    pendingReasons |= reasons;
    if (syncScheduled) return;
    syncScheduled = true;
    const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (cb) => setTimeout(cb, 16);
    raf(() => {
      syncScheduled = false;
      const runReasons = pendingReasons || SYNC_ALL;
      pendingReasons = 0;
      relocateUserBar(runReasons);
    });
  }

  window.__HAVEN_MOBILE_FOCUS_SYNC__ = () => {
    fullClutterSweepDone = false;
    modalsCleanOnce = false;
    scheduleSync(SYNC_ALL);
  };

  window.__HAVEN_TRIM_MEMORY__ = () => {
    pendingClutterRoots.clear();
    pendingMediaRoots.clear();
    dismissModals();
  };

  function handleMutations(mutations) {
    if (isSyncing || !Array.isArray(mutations)) return;

    let reasons = 0;
    for (let i = 0; i < mutations.length; i++) {
      const m = mutations[i];
      const added = m.addedNodes;
      if (!added || added.length === 0) continue;

      const target = m.target;
      const insideChatFeed = Boolean(
        target && typeof target.closest === 'function' && target.closest(CHAT_FEED_SELECTOR)
      );

      for (let j = 0; j < added.length; j++) {
        const node = added[j];
        if (!node || node.nodeType !== 1) continue;

        const id = node.id;
        if (
          id === 'push-error-modal' ||
          id === 'android-beta-modal' ||
          id === 'desktop-promo-modal' ||
          id === 'android-beta-banner'
        ) {
          reasons |= SYNC_MODALS;
        }

        if (node.tagName === 'IMG' || node.tagName === 'VIDEO' || (node.firstElementChild && pendingMediaRoots.size < 64)) {
          pendingMediaRoots.add(node);
          reasons |= SYNC_MEDIA;
        }

        // Skip full clutter/sidebar checks during high-frequency chat message appends
        if (!insideChatFeed) {
          reasons |= SYNC_CLUTTER | SYNC_SIDEBAR;
          if (pendingClutterRoots.size < 48) {
            pendingClutterRoots.add(node);
          }
        }
      }
    }

    if (reasons !== 0) {
      scheduleSync(reasons);
    }
  }

  function attachObserverAndSync() {
    injectStyles();
    relocateUserBar(SYNC_ALL);
    const observeTarget = document.body || document.documentElement;
    if (!observeTarget) return false;
    if (!window.__HAVEN_MOBILE_FOCUS_OBSERVER__) {
      const observer = new MutationObserver(handleMutations);
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
