import { preloadRuntimeSources, REQUIRED_GAME_RUNTIMES } from './runtimeManifest.js';

export function loadClassicRuntime(src, dataKey) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing?.dataset.apexLoaded === 'true') {
      resolve();
      return;
    }

    const runtime = existing || document.createElement('script');
    runtime.src = src;
    runtime.async = false;
    runtime.dataset[dataKey] = 'true';
    runtime.onload = () => {
      runtime.dataset.apexLoaded = 'true';
      resolve();
    };
    runtime.onerror = () => reject(new Error(`Failed to load ${src}`));
    if (!existing) document.body.appendChild(runtime);
  });
}

export async function loadRequiredGameRuntimes() {
  preloadRuntimeSources();
  for (const [src, dataKey] of REQUIRED_GAME_RUNTIMES) {
    await loadClassicRuntime(src, dataKey);
  }
}
