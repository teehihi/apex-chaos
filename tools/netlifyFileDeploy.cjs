const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const siteId = process.argv[2];
const distDir = path.resolve(process.argv[3] || 'dist');

if (!siteId) {
  console.error('Usage: node tools/netlifyFileDeploy.cjs <siteId> [distDir]');
  process.exit(2);
}

const configPath = path.join(os.homedir(), 'AppData', 'Roaming', 'netlify', 'Config', 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const firstUser = Object.values(config.users || {})[0];
const token = firstUser?.auth?.token;

if (!token) {
  console.error('No Netlify auth token found in config.');
  process.exit(1);
}

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

function sha1(file) {
  return crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex');
}

function deployPath(file) {
  return `/${path.relative(distDir, file).replace(/\\/g, '/')}`;
}

function endpointFilePath(filePath) {
  return filePath.split('/').map((part) => encodeURIComponent(part)).join('/');
}

async function api(pathname, options = {}) {
  const response = await fetch(`https://api.netlify.com/api/v1${pathname}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let data = text;
  try { data = text ? JSON.parse(text) : null; } catch {}
  if (!response.ok) {
    throw new Error(JSON.stringify({ status: response.status, data }, null, 2));
  }
  return data;
}

async function uploadOne(deployId, filePath, fullPath) {
  await api(`/deploys/${deployId}/files${endpointFilePath(filePath)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: fs.readFileSync(fullPath)
  });
}

async function runPool(items, worker, concurrency = 4) {
  let cursor = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (cursor < items.length) {
      const current = items[cursor++];
      await worker(current);
    }
  });
  await Promise.all(workers);
}

async function main() {
  const files = walk(distDir);
  const byPath = new Map();
  const byHash = new Map();
  const fileManifest = {};
  let totalBytes = 0;

  for (const file of files) {
    const p = deployPath(file);
    const hash = sha1(file);
    byPath.set(p, file);
    byHash.set(hash, { path: p, full: file });
    fileManifest[p] = hash;
    totalBytes += fs.statSync(file).size;
  }

  console.log(JSON.stringify({ step: 'manifest', files: files.length, totalBytes }, null, 2));

  const created = await api(`/sites/${siteId}/deploys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files: fileManifest })
  });

  const required = created.required || created.required_files || [];
  console.log(JSON.stringify({ step: 'created', id: created.id, state: created.state, required: required.length }, null, 2));

  let uploaded = 0;
  await runPool(required, async (filePath) => {
    const file = byPath.has(filePath) ? { path: filePath, full: byPath.get(filePath) } : byHash.get(filePath);
    if (!file) throw new Error(`Required file not found in manifest: ${filePath}`);
    await uploadOne(created.id, file.path, file.full);
    uploaded += 1;
    if (uploaded % 10 === 0 || uploaded === required.length) {
      console.log(JSON.stringify({ step: 'uploading', uploaded, required: required.length }));
    }
  }, 4);

  let latest = created;
  for (let i = 0; i < 60; i += 1) {
    latest = await api(`/deploys/${created.id}`);
    if (['ready', 'current', 'uploaded'].includes(latest.state) && !latest.required?.length) break;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  console.log(JSON.stringify({
    step: 'done',
    id: latest.id,
    state: latest.state,
    deploy_ssl_url: latest.deploy_ssl_url,
    ssl_url: latest.ssl_url,
    admin_url: latest.admin_url
  }, null, 2));
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});
