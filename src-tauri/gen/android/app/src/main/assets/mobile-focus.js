(function () {
  'use strict';

  // 1. Suppress push notification errors immediately
  window.__DISABLE_PUSH_PROMPT__ = true;
  try {
    localStorage.setItem('haven_push_error_dismissed', 'true');
  } catch(e){}

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
        try { dismissBtn.click(); } catch(e){}
      }
      pushModal.remove();
    }
    const betaModal = document.getElementById('android-beta-modal');
    if (betaModal) {
      betaModal.style.setProperty('display', 'none', 'important');
      betaModal.remove();
    }
    const promoModal = document.getElementById('desktop-promo-modal');
    if (promoModal) {
      promoModal.style.setProperty('display', 'none', 'important');
      promoModal.remove();
    }

    if (window.app && typeof window.app._showPushError === 'function') {
      window.app._showPushError = function() {};
    }
  }

  // 2. Inject CSS styles for Discord Mobile Parity
  function injectStyles() {
    dismissModals();
    if (document.getElementById('haven-mobile-focus-styles')) return;

    const style = document.createElement('style');
    style.id = 'haven-mobile-focus-styles';
    style.textContent = `
      :root {
        --safe-bottom: env(safe-area-inset-bottom, 0px);
        --safe-top: env(safe-area-inset-top, 0px);
      }

      /* Suppress annoying modals */
      #push-error-modal, #android-beta-modal, #desktop-promo-modal,
      .android-beta-promo, .desktop-promo, #haven-mobile-focus-dock {
        display: none !important;
        opacity: 0 !important;
        pointer-events: none !important;
        visibility: hidden !important;
      }

      /* Hide desktop elements */
      #titlebar, .window-controls, .desktop-decorations, .sidebar-resize-handle {
        display: none !important;
      }

      /* Top Channel Header: Discord Mobile style */
      .channel-header, #chat-header, .chat-header {
        height: 48px !important;
        min-height: 48px !important;
        padding: 0 10px !important;
        background: #2b2d31 !important;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
      }

      #mobile-menu-btn {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 36px !important;
        height: 36px !important;
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

      #channel-header-name {
        font-size: 15.5px !important;
        font-weight: 700 !important;
        color: #f2f3f5 !important;
      }

      #mobile-users-btn {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 36px !important;
        height: 36px !important;
        color: #949ba4 !important;
        background: transparent !important;
        border: none !important;
      }

      /* Clean Discord Mobile Pill Composer */
      #message-input-area, .message-input-area {
        position: relative !important;
        background: #383a40 !important;
        border-radius: 20px !important;
        border: 1px solid rgba(255, 255, 255, 0.08) !important;
        margin: 6px 10px calc(6px + env(safe-area-inset-bottom, 0px)) 10px !important;
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
      #composer-plus-btn, .btn-composer-plus,
      #gif-btn, .btn-gif,
      #poll-btn, .btn-poll,
      #time-btn, .btn-time,
      #format-btn, .btn-format,
      #voice-btn, .btn-voice-msg,
      #self-destruct-btn, .btn-self-destruct,
      #silent-btn, .btn-silent,
      #highlight-btn, .btn-highlight,
      #burn-btn, .btn-burn,
      #sb-sidebar-toggle-btn, .sb-sidebar-toggle-btn,
      .input-actions-divider, .pip-input-resizer,
      .sidebar-bottom-bar, .braid-more-wrap,
      #braid-more-btn, #braid-theme-btn, #braid-classic-btn,
      .braid-bar-btn, #braid-return-pill, .braid-return-pill, .braid-return-float {
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

      /* Sidebar & User Bar */
      .sidebar-bottom {
        margin-top: auto !important;
        border-top: none !important;
      }

      .user-bar {
        display: flex !important;
        align-items: center !important;
        background: #232428 !important;
        padding: 6px 10px !important;
        margin: 0 !important;
        border-top: 1px solid rgba(255, 255, 255, 0.06) !important;
        height: 52px !important;
        box-sizing: border-box !important;
        gap: 6px !important;
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
    `;
    (document.head || document.documentElement).appendChild(style);
    dismissModals();
  }

  // 3. Double click/tap on channel to directly join voice!
  function triggerVoiceJoin(code) {
    if (!code || !window.app) return;
    if (window.app.currentChannel !== code) {
      window.app.switchChannel(code);
    }
    const attempt = () => {
      if (window.app && typeof window.app._joinVoice === 'function') {
        window.app._joinVoice();
      } else {
        document.getElementById('voice-join-btn')?.click();
      }
    };
    setTimeout(attempt, 100);
    setTimeout(attempt, 350);
  }

  // Double click listener (Desktop & Mouse)
  document.addEventListener('dblclick', (e) => {
    const item = e.target.closest('.channel-item');
    if (!item) return;
    if (e.target.closest('.channel-more-btn') || e.target.closest('.channel-collapse-arrow')) return;

    const code = item.dataset.code;
    if (code) {
      triggerVoiceJoin(code);
    }
  }, true);

  // Passive touch tracking for Mobile (No event blocking!)
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

  function relocateUserBar() {
    injectStyles();

    // Remove clutter elements
    document.querySelectorAll(
      '#composer-plus-btn, .btn-composer-plus, #gif-btn, .btn-gif, #poll-btn, .btn-poll, #time-btn, .btn-time, #format-btn, .btn-format, #voice-btn, .btn-voice-msg, #self-destruct-btn, .btn-self-destruct, #silent-btn, .btn-silent, #highlight-btn, .btn-highlight, #burn-btn, .btn-burn, #sb-sidebar-toggle-btn, .sb-sidebar-toggle-btn, .input-actions-divider, .pip-input-resizer, .sidebar-bottom-bar, .braid-more-wrap, #braid-more-btn, #braid-theme-btn, #braid-classic-btn, .braid-bar-btn, #braid-return-pill, .braid-return-pill, .braid-return-float'
    ).forEach(el => el.remove());

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

      if (muteBtn && muteBtn.parentElement !== userBar) {
        muteBtn.style.display = 'flex';
        userBar.appendChild(muteBtn);
      }
      if (deafenBtn && deafenBtn.parentElement !== userBar) {
        deafenBtn.style.display = 'flex';
        userBar.appendChild(deafenBtn);
      }
      if (settingsBtn && settingsBtn.parentElement !== userBar) {
        settingsBtn.style.display = 'flex';
        userBar.appendChild(settingsBtn);
      }
    }
  }

  // Initialization
  injectStyles();
  relocateUserBar();

  const observer = new MutationObserver(() => {
    relocateUserBar();
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      injectStyles();
      relocateUserBar();
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }
})();
