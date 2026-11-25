const test = require('node:test');
const assert = require('node:assert');
const https = require('node:https');

const SERVER_HOST = 'haven.khanhs.io.vn';

function fetchUrl(path) {
  return new Promise((resolve, reject) => {
    https.get({
      hostname: SERVER_HOST,
      path: path,
      headers: { 'User-Agent': 'Haven-Automated-Auditor/1.0' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, data }));
    }).on('error', reject);
  });
}

test('Haven Discord UI & Mobile Layout Verification', async (t) => {
  const appRes = await fetchUrl('/app');
  assert.strictEqual(appRes.statusCode, 200, 'Expected HTTP 200 from /app');
  const html = appRes.data;

  await t.test('DOM: Exactly one user-bar exists inside sidebar-bottom', () => {
    const userBarMatches = html.match(/class=["'][^"']*\buser-bar\b(?!-)[^"']*["']/g) || [];
    assert.strictEqual(userBarMatches.length, 1, `Found ${userBarMatches.length} user-bar instances`);
    
    const sidebarBottomIndex = html.indexOf('class="sidebar-bottom"');
    const userBarIndex = html.indexOf('class="user-bar"');
    const asideCloseIndex = html.indexOf('</aside>', sidebarBottomIndex);
    assert.ok(sidebarBottomIndex !== -1, 'sidebar-bottom element exists');
    assert.ok(userBarIndex > sidebarBottomIndex && userBarIndex < asideCloseIndex, 'user-bar must be inside sidebar-bottom');
  });

  await t.test('DOM: sidebar-header contains only brand and close button', () => {
    const headerStart = html.indexOf('class="sidebar-header"');
    const headerChunk = html.substring(headerStart, headerStart + 600);
    assert.ok(!headerChunk.includes('user-bar'), 'sidebar-header must not contain user-bar');
    assert.ok(!headerChunk.includes('id="logout-btn"'), 'sidebar-header must not contain logout button');
  });

  await t.test('DOM: aside.sidebar tag nesting is perfectly balanced', () => {
    const asideStart = html.indexOf('<aside class="sidebar"');
    const asideEnd = html.indexOf('</aside>', asideStart);
    assert.ok(asideStart !== -1 && asideEnd !== -1, 'aside.sidebar tags exist');
    const sidebarHtml = html.substring(asideStart, asideEnd);
    const openDivs = (sidebarHtml.match(/<div[\s>]/g) || []).length;
    const closeDivs = (sidebarHtml.match(/<\/div>/g) || []).length;
    assert.strictEqual(openDivs, closeDivs, `Div tags mismatch: ${openDivs} open vs ${closeDivs} close`);
  });

  await t.test('Composer: Single upload button and clean Vietnamese placeholder', () => {
    const uploadBtns = html.match(/id=["']upload-btn["']/g) || [];
    assert.strictEqual(uploadBtns.length, 1, `Found ${uploadBtns.length} upload-btn`);
    assert.ok(html.includes('Nhập tin nhắn... (/ cho lệnh)'), 'Message placeholder must be Vietnamese');
  });

  await t.test('Composer: Clutter buttons stashed in hidden container', () => {
    assert.ok(html.includes('id="composer-stashed-buttons"'), 'composer-stashed-buttons container must exist');
    assert.ok(html.includes('id="composer-plus-btn"'), 'composer-plus-btn must be preserved in stashed container');
  });

  await t.test('Layout: Legacy sidebar-bottom-bar is absent', () => {
    assert.ok(!html.includes('class="sidebar-bottom-bar"'), 'sidebar-bottom-bar must not exist');
  });

  await t.test('Styles: style.css imports discord-theme.css with v=5.8.0', async () => {
    const styleRes = await fetchUrl('/css/style.css?v=5.8.0');
    assert.strictEqual(styleRes.statusCode, 200);
    assert.ok(styleRes.data.includes("discord-theme.css?v=5.8.0"));
  });

  await t.test('Styles: discord-theme.css provides Discord design tokens', async () => {
    const discordThemeRes = await fetchUrl('/css/discord-theme.css?v=5.8.0');
    assert.strictEqual(discordThemeRes.statusCode, 200);
    assert.ok(discordThemeRes.data.includes('#5865F2'));
    assert.ok(discordThemeRes.data.includes('#313338'));
    assert.ok(discordThemeRes.data.includes('#2b2d31'));
  });

  await t.test('Voice: app-channels.js supports double-tap touch and double-click voice join', async () => {
    const channelsRes = await fetchUrl('/js/modules/app-channels.js?v=5.8.0');
    assert.strictEqual(channelsRes.statusCode, 200);
    assert.ok(channelsRes.data.includes('_chTouchStart'));
    assert.ok(channelsRes.data.includes('_chLastTap'));
    assert.ok(channelsRes.data.includes('this._joinVoice()'));
  });

  await t.test('Auto-Select: app-socket-channels.js auto-switches to first public channel on load', async () => {
    const socketChRes = await fetchUrl('/js/modules/app-socket-channels.js?v=5.8.0');
    assert.strictEqual(socketChRes.statusCode, 200);
    assert.ok(socketChRes.data.includes('autoCh'));
    assert.ok(socketChRes.data.includes('this.switchChannel(autoCh.code)'));
  });

  await t.test('Braid: BraidLayout.plugin.js _buildMoreMenu is completely neutralized', async () => {
    const braidRes = await fetchUrl('/plugins/BraidLayout.plugin.js');
    assert.strictEqual(braidRes.statusCode, 200);
    assert.ok(braidRes.data.includes('_buildMoreMenu()'));
    assert.ok(braidRes.data.includes('.remove()'));
  });
});
