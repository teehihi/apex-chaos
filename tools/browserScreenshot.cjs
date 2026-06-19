const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');

const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9231;
const url = process.argv[2];
const out = process.argv[3];
const width = Number(process.argv[4] || 390);
const height = Number(process.argv[5] || 844);

function requestJson(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path, method }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (err) { reject(new Error(`${err.message}: ${data.slice(0, 200)}`)); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForDebug() {
  for (let i = 0; i < 80; i += 1) {
    try { await requestJson('/json/version'); return; } catch { await wait(100); }
  }
  throw new Error('Chrome debugging endpoint did not start');
}

async function main() {
  if (!url || !out) throw new Error('Usage: node tools/browserScreenshot.cjs <url> <out> [width] [height]');
  const child = spawn(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--disable-extensions',
    `--remote-debugging-port=${port}`,
    `--window-size=${width},${height}`,
    'about:blank'
  ], { stdio: 'ignore' });

  try {
    await waitForDebug();
    const created = await requestJson(`/json/new?${encodeURIComponent(url)}`, 'PUT');
    const ws = new WebSocket(created.webSocketDebuggerUrl);
    let id = 0;
    const pending = new Map();
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const msgId = ++id;
      pending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
    ws.addEventListener('message', (message) => {
      const data = JSON.parse(message.data);
      if (data.id && pending.has(data.id)) {
        const p = pending.get(data.id);
        pending.delete(data.id);
        if (data.error) p.reject(new Error(JSON.stringify(data.error)));
        else p.resolve(data.result);
      }
    });
    await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }));
    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
    await send('Page.navigate', { url });
    await wait(8500);
    const shot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
    fs.writeFileSync(out, Buffer.from(shot.data, 'base64'));
    ws.close();
  } finally {
    child.kill();
  }
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});
