import {
  BOOT_GAME_RUNTIMES,
  DEFERRED_GAME_RUNTIMES,
  prefetchDeferredRuntimeSources,
  preloadRuntimeSources,
} from './runtimeManifest.js';

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

async function loadRuntimeList(runtimes) {
  for (const [src, dataKey, options = {}] of runtimes) {
    try {
      await loadClassicRuntime(src, dataKey);
    } catch (error) {
      if (!options.optional) throw error;
      console.warn(`[asset-loader] Optional runtime failed: ${src}`);
    }
  }
}

export async function loadRequiredGameRuntimes() {
  preloadRuntimeSources();
  return loadRuntimeList(BOOT_GAME_RUNTIMES);
}

export function loadDeferredGameRuntimes() {
  if (window.__apexDeferredRuntimesPromise) return window.__apexDeferredRuntimesPromise;
  prefetchDeferredRuntimeSources();
  window.__apexDeferredRuntimesPromise = loadRuntimeList(DEFERRED_GAME_RUNTIMES)
    .then(() => {
      window.__apexDeferredRuntimesReady = true;
    })
    .catch((error) => {
      window.__apexDeferredRuntimesPromise = null;
      throw error;
    });
  return window.__apexDeferredRuntimesPromise;
}

export function scheduleDeferredGameRuntimes() {
  prefetchDeferredRuntimeSources();
  const start = () => {
    loadDeferredGameRuntimes().catch((error) => {
      console.warn('[asset-loader] Failed deferred game runtime.', error);
    });
  };
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(start, { timeout: 1600 });
  } else {
    window.setTimeout(start, 900);
  }
}
