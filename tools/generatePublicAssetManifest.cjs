const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'public');
const outputPath = path.join(publicDir, 'asset-manifest.json');

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.avif']);
const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.mov']);
const DATA_EXTENSIONS = new Set(['.json']);
const SCRIPT_EXTENSIONS = new Set(['.js']);

function toPublicPath(absPath) {
  return `/${path.relative(publicDir, absPath)
    .split(path.sep)
    .map((segment) => encodeURIComponent(segment))
    .join('/')}`;
}

function assetType(absPath) {
  const ext = path.extname(absPath).toLowerCase();
  if (IMAGE_EXTENSIONS.has(ext)) return 'image';
  if (AUDIO_EXTENSIONS.has(ext)) return 'audio';
  if (VIDEO_EXTENSIONS.has(ext)) return 'video';
  if (SCRIPT_EXTENSIONS.has(ext)) return 'script';
  if (DATA_EXTENSIONS.has(ext)) return 'data';
  return null;
}

function shouldPreloadPublicAsset(publicPath) {
  const normalized = publicPath.replace(/\\/g, '/');
  const soccerMove = normalized.match(/^\/assets\/soccer_v1\/move\/frame_(\d{3})\.png$/i);
  if (soccerMove) return soccerMove[1] === '065' || soccerMove[1] === '066';
  return true;
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(fullPath, out);
    else out.push(fullPath);
  }
  return out;
}

const files = [
  ...walk(path.join(publicDir, 'assets')),
  path.join(publicDir, 'apexEngine.js'),
  path.join(publicDir, 'sniper_cloak_move_sprite.png'),
  path.join(publicDir, 'sniper_cloak_sprite.png'),
].filter((filePath) => {
  if (!fs.existsSync(filePath)) return false;
  const publicPath = toPublicPath(filePath);
  if (publicPath === '/asset-manifest.json') return false;
  if (/apexEngine\.before_/i.test(publicPath)) return false;
  if (!shouldPreloadPublicAsset(publicPath)) return false;
  return assetType(filePath);
});

const seen = new Set();
const assets = files
  .map((filePath) => ({
    path: toPublicPath(filePath),
    type: assetType(filePath),
    bytes: fs.statSync(filePath).size,
  }))
  .filter((asset) => {
    if (seen.has(asset.path)) return false;
    seen.add(asset.path);
    return true;
  })
  .sort((a, b) => a.path.localeCompare(b.path));

const loadingAssets = {
  bgPortrait: '/assets/loading/loading-bg-portrait.png',
  bgLandscape: '/assets/loading/loading-bg-landscape.png',
  gameTitle: '/assets/loading/apex-chaos-title.png',
  loadingBarFrame: '/assets/loading/loading-bar-frame.png',
};

fs.writeFileSync(
  outputPath,
  `${JSON.stringify({ generatedAt: new Date().toISOString(), loadingAssets, assets }, null, 2)}\n`,
  'utf8',
);

console.log(JSON.stringify({ output: outputPath, assets: assets.length }, null, 2));
