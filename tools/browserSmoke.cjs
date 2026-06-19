const http = require('http');
const { spawn } = require('child_process');

const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9227;
const url = process.argv[2] || 'http://127.0.0.1:5173/';

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

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForDebug() {
  for (let i = 0; i < 80; i += 1) {
    try {
      await requestJson('/json/version');
      return;
    } catch {
      await wait(100);
    }
  }
  throw new Error('Chrome debugging endpoint did not start');
}

async function main() {
  const child = spawn(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--disable-extensions',
    `--remote-debugging-port=${port}`,
    'about:blank'
  ], { stdio: 'ignore' });

  try {
    await waitForDebug();
    const created = await requestJson(`/json/new?${encodeURIComponent(url)}`, 'PUT');
    const ws = new WebSocket(created.webSocketDebuggerUrl);
    let id = 0;
    const pending = new Map();
    const events = [];
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
        return;
      }
      if (data.method === 'Runtime.consoleAPICalled') {
        events.push({ type: 'console', level: data.params.type, text: data.params.args.map((a) => a.value || a.description || '').join(' ') });
      }
      if (data.method === 'Runtime.exceptionThrown') {
        events.push({ type: 'exception', text: data.params.exceptionDetails.text, details: data.params.exceptionDetails.exception?.description });
      }
      if (data.method === 'Log.entryAdded') {
        events.push({ type: 'log', level: data.params.entry.level, text: data.params.entry.text, url: data.params.entry.url });
      }
    });

    await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }));
    await send('Runtime.enable');
    await send('Log.enable');
    await send('Page.enable');
    await send('Page.navigate', { url });
    await wait(9000);
    const evalResult = await send('Runtime.evaluate', {
      expression: `(() => ({
        bodyText: document.body.innerText.slice(0, 500),
        rootChildren: document.getElementById('root')?.children.length || 0,
        loader: document.getElementById('loading-screen')?.className || null,
        menuHidden: document.getElementById('menu-screen')?.classList.contains('hidden') || false,
        menuButtons: [...document.querySelectorAll('#menu-screen .menu-image-button')].map(b => ({
          label: b.getAttribute('aria-label'),
          disabled: b.disabled,
          img: b.querySelector('img')?.getAttribute('src'),
          width: Math.round(b.getBoundingClientRect().width),
          height: Math.round(b.getBoundingClientRect().height)
        })),
        earlyErrors: window.apexEarlyErrors || [],
        hasGoToMenu: typeof window.goToMenu,
        scripts: [...document.scripts].map(s => s.src || '[inline]').slice(-5)
      }))()`,
      returnByValue: true
    });
    console.log(JSON.stringify({ page: evalResult.result.value, events }, null, 2));
    ws.close();
  } finally {
    child.kill();
  }
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});
