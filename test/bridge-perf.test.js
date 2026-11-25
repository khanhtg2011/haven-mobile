const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const BRIDGE_PATH = path.join(ROOT, 'src', 'tauri-bridge', 'haven-bridge.js');
const MOBILE_FOCUS_PATH = path.join(
  ROOT,
  'src-tauri',
  'gen',
  'android',
  'app',
  'src',
  'main',
  'assets',
  'mobile-focus.js'
);
const MAIN_ACTIVITY_PATH = path.join(
  ROOT,
  'src-tauri',
  'gen',
  'android',
  'app',
  'src',
  'main',
  'java',
  'com',
  'haven',
  'desktop',
  'MainActivity.kt'
);

test('Mobile Cargo.toml configures compact LTO release profile', () => {
  const cargoToml = fs.readFileSync(path.join(ROOT, 'src-tauri', 'Cargo.toml'), 'utf8');
  assert.match(cargoToml, /\[profile\.release\]/);
  assert.match(cargoToml, /opt-level\s*=\s*"z"/);
  assert.match(cargoToml, /lto\s*=\s*true/);
  assert.match(cargoToml, /codegen-units\s*=\s*1/);
  assert.match(cargoToml, /panic\s*=\s*"abort"/);
  assert.match(cargoToml, /strip\s*=\s*true/);
});

test('Android workflow targets main branch with prerelease gate', () => {
  const wf = fs.readFileSync(
    path.join(ROOT, '.github', 'workflows', 'build-android.yml'),
    'utf8'
  );
  assert.match(wf, /branches:\s*\r?\n\s*-\s*main/);
  assert.match(wf, /prerelease:\s*true/);
});

test('All renderer, bridge, and mobile-focus JS scripts parse cleanly', () => {
  const jsFiles = [
    BRIDGE_PATH,
    MOBILE_FOCUS_PATH,
    ...fs
      .readdirSync(path.join(ROOT, 'src', 'renderer'))
      .filter((name) => name.endsWith('.js'))
      .map((name) => path.join(ROOT, 'src', 'renderer', name)),
  ];

  for (const file of jsFiles) {
    const code = fs.readFileSync(file, 'utf8');
    assert.doesNotThrow(() => new vm.Script(code, { filename: file }), `Syntax error in ${file}`);
  }
});

test('Mobile bridge coalesces DOM MutationObserver with requestAnimationFrame and keeps Android identity', () => {
  const bridgeJs = fs.readFileSync(BRIDGE_PATH, 'utf8');
  assert.ok(!bridgeJs.includes('new MutationObserver(purgeModals)'));
  assert.match(bridgeJs, /MutationObserver\(schedulePurge\)/);
  assert.match(bridgeJs, /requestAnimationFrame/);
  assert.match(bridgeJs, /scheduleOverlayTick/);

  const sandbox = createBrowserSandbox({
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 Chrome/128.0.0.0 Mobile Safari/537.36 HavenMobile/2.0.0',
    nullDomAtStart: true,
  });
  assert.doesNotThrow(() => vm.runInContext(bridgeJs, sandbox));
  assert.strictEqual(sandbox.window.havenAPI.platform, 'android');
  assert.strictEqual(sandbox.window.havenAPI.isDesktop, false);
  assert.strictEqual(sandbox.window.havenAPI.isMobileApp, true);
  assert.ok(!sandbox.navigator.userAgent.includes('Electron/'));
  sandbox.emitDocumentEvent('DOMContentLoaded');
  assert.strictEqual(sandbox.createdIds.has('haven-mobile-focus-dock'), false);
});

test('mobile-focus.js survives document-start null DOM, deduplicates listeners, and only voice-joins voice channels', () => {
  const focusJs = fs.readFileSync(MOBILE_FOCUS_PATH, 'utf8');
  const sandbox = createBrowserSandbox({
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Mobile) HavenMobile/2.0.0',
    nullDomAtStart: true,
  });

  // Initial document-start evaluation must not throw even when head/documentElement/body are null
  assert.doesNotThrow(() => vm.runInContext(focusJs, sandbox));
  sandbox.mountDom();
  sandbox.emitDocumentEvent('DOMContentLoaded');
  assert.strictEqual(sandbox.createdIds.has('haven-mobile-focus-styles'), true);

  const countBefore = { ...sandbox.docListenerCounts };
  const observersBefore = sandbox.observerInstances;

  // Re-evaluating script multiple times (e.g. SPA history transitions) must stay idempotent
  vm.runInContext(focusJs, sandbox);
  vm.runInContext(focusJs, sandbox);
  vm.runInContext(focusJs, sandbox);
  assert.deepStrictEqual(sandbox.docListenerCounts, countBefore);
  assert.strictEqual(sandbox.observerInstances, observersBefore);

  // Check overflow fixes, settings responsiveness & status-bar-toggle hiding are compiled in CSS
  assert.match(focusJs, /#status-bar-toggle/);
  assert.match(focusJs, /#mentions-btn/);
  assert.match(focusJs, /#settings-modal\s+\.modal\.modal-settings/);

  // Double-click on standard text channel must NOT force voice join
  let joinCalls = 0;
  let switchedTo = null;
  sandbox.window.app = {
    currentChannel: 'dccf6d21',
    channels: [
      { code: 'db03bf77', name: 'Text Chat', channel_type: 'standard' },
      { code: 'f5b41ec5', name: 'Voice Room', channel_type: 'voice' },
    ],
    switchChannel: (code) => {
      switchedTo = code;
      sandbox.window.app.currentChannel = code;
    },
    _joinVoice: () => {
      joinCalls++;
    },
  };

  sandbox.dispatchDblClick({ code: 'db03bf77', isVoiceDom: false });
  sandbox.flushTimers();
  assert.strictEqual(joinCalls, 0);

  sandbox.dispatchDblClick({ code: 'f5b41ec5', isVoiceDom: true });
  sandbox.flushTimers();
  assert.strictEqual(switchedTo, 'f5b41ec5');
  assert.ok(joinCalls >= 1);
});

test('MainActivity.kt avoids infinite periodic injection loop and handles window insets + cleanup', () => {
  const kt = fs.readFileSync(MAIN_ACTIVITY_PATH, 'utf8');
  assert.ok(!kt.includes('postDelayed(this, 1200)'), 'Infinite 1200ms injector loop must be removed');
  assert.match(kt, /override fun onDestroy\(\)/);
  assert.match(kt, /removeCallbacksAndMessages\(null\)/);
  assert.match(kt, /WindowInsetsCompat\.Type\.systemBars\(\)\s+or\s+WindowInsetsCompat\.Type\.ime\(\)/);
});

function createBrowserSandbox({ userAgent, nullDomAtStart }) {
  const createdIds = new Set();
  const docListenerCounts = {};
  const docHandlers = {};
  const timers = [];
  let observerInstances = 0;

  const makeEl = (tag, id = '') => ({
    tagName: tag,
    id,
    children: [],
    style: { setProperty: () => {} },
    setAttribute: () => {},
    appendChild(child) {
      if (child && child.id) createdIds.add(child.id);
      this.children.push(child);
      return child;
    },
    prepend: () => {},
    remove: () => {},
    closest: () => null,
    querySelector: () => null,
  });

  const headEl = makeEl('HEAD', 'head');
  const htmlEl = makeEl('HTML', 'html');
  const bodyEl = makeEl('BODY', 'body');
  const storage = new Map();

  const documentObj = {
    head: nullDomAtStart ? null : headEl,
    documentElement: nullDomAtStart ? null : htmlEl,
    body: nullDomAtStart ? null : bodyEl,
    readyState: nullDomAtStart ? 'loading' : 'complete',
    createElement: (tag) => makeEl(tag.toUpperCase()),
    getElementById: (id) => (createdIds.has(id) ? makeEl('DIV', id) : null),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener(type, fn) {
      docListenerCounts[type] = (docListenerCounts[type] || 0) + 1;
      if (!docHandlers[type]) docHandlers[type] = [];
      docHandlers[type].push(fn);
    },
  };

  class MockMutationObserver {
    constructor(cb) {
      this.cb = cb;
      observerInstances++;
    }
    observe() {}
    disconnect() {}
  }

  const windowObj = {
    addEventListener(type, fn) {
      if (!docHandlers[`win:${type}`]) docHandlers[`win:${type}`] = [];
      docHandlers[`win:${type}`].push(fn);
    },
    Notification: { permission: 'default', requestPermission: () => Promise.resolve('granted') },
    navigator: { userAgent, permissions: { query: () => Promise.resolve({ state: 'granted' }) } },
    localStorage: {
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => storage.set(k, String(v)),
    },
    document: documentObj,
    requestAnimationFrame: (cb) => timers.push(cb),
    setTimeout: (cb) => {
      timers.push(cb);
      return timers.length;
    },
    clearTimeout: () => {},
    setInterval: () => 1,
    clearInterval: () => {},
  };
  windowObj.window = windowObj;
  windowObj.MutationObserver = MockMutationObserver;

  const ctx = vm.createContext(windowObj);

  return Object.assign(ctx, {
    createdIds,
    docListenerCounts,
    get observerInstances() {
      return observerInstances;
    },
    mountDom() {
      documentObj.head = headEl;
      documentObj.documentElement = htmlEl;
      documentObj.body = bodyEl;
      documentObj.readyState = 'interactive';
    },
    emitDocumentEvent(type) {
      for (const fn of docHandlers[type] || []) fn({ type });
    },
    dispatchDblClick({ code, isVoiceDom }) {
      const item = {
        dataset: { code },
        classList: { contains: (c) => isVoiceDom && c === 'voice-channel' },
        querySelector: (sel) => {
          if (sel === '.channel-voice-indicator') return isVoiceDom ? {} : null;
          if (sel === '.channel-hash') return { textContent: isVoiceDom ? '\u{1F50A}' : '#' };
          return null;
        },
      };
      const event = {
        target: {
          closest: (sel) => (sel === '.channel-item' ? item : null),
        },
      };
      for (const fn of docHandlers.dblclick || []) fn(event);
    },
    flushTimers() {
      while (timers.length) {
        const fn = timers.shift();
        fn();
      }
    },
  });
}
