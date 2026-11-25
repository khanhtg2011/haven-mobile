const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

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

test('Mobile bridge coalesces DOM MutationObserver with requestAnimationFrame', () => {
  const bridgeJs = fs.readFileSync(
    path.join(ROOT, 'src', 'tauri-bridge', 'haven-bridge.js'),
    'utf8'
  );
  assert.ok(!bridgeJs.includes('new MutationObserver(purgeModals)'));
  assert.match(bridgeJs, /MutationObserver\(schedulePurge\)/);
  assert.match(bridgeJs, /requestAnimationFrame/);
  assert.match(bridgeJs, /scheduleOverlayTick/);
});
