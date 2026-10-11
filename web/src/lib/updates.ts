import { registerSW } from 'virtual:pwa-register';
import { create } from 'zustand';
import { getSocket } from './socket';

/**
 * Keeps open tabs and the home-screen app on the latest version.
 *
 * The service worker caches the app so it opens fast, which also means a
 * deploy isn't picked up until the cached copy is swapped out. We find out
 * about new versions three ways: the server announces its build id on every
 * socket connection (a deploy restarts the server, so every client reconnects
 * and notices), a check every 30 minutes, and a check whenever the app comes
 * back to the foreground. Then we offer a reload, or do it automatically while
 * the app is in the background and nobody is typing.
 */

export const BUILD_ID = __BUILD_ID__;
const CHECK_EVERY_MS = 30 * 60 * 1000;

export const useUpdate = create<{ available: boolean; applying: boolean }>(() => ({ available: false, applying: false }));

let registration: ServiceWorkerRegistration | undefined;
let started = false;

function isTyping(): boolean {
  const el = document.activeElement as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
}

function markAvailable() {
  useUpdate.setState({ available: true });
  if (document.visibilityState === 'hidden' && !isTyping()) void applyUpdate();
}

/** Waits (briefly) for a freshly found service worker to finish installing. */
function waitForInstall(worker: ServiceWorker): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      if (worker.state !== 'installing') {
        worker.removeEventListener('statechange', done);
        resolve();
      }
    };
    worker.addEventListener('statechange', done);
    setTimeout(resolve, 15_000);
    done();
  });
}

/**
 * Swaps in the new version and reloads. A plain reload isn't enough: the
 * still-active old service worker would serve the old cached app again.
 */
export async function applyUpdate(): Promise<void> {
  if (useUpdate.getState().applying) return;
  useUpdate.setState({ applying: true });
  const sw = navigator.serviceWorker;
  try {
    if (registration && !registration.waiting) {
      await registration.update().catch(() => {});
      const fresh = registration.installing;
      if (fresh) await waitForInstall(fresh);
    }
    const waiting = registration?.waiting;
    if (waiting && sw?.controller) {
      // The generated worker activates on this message; wait for it to take control of the page.
      await new Promise<void>((resolve) => {
        sw.addEventListener('controllerchange', () => resolve(), { once: true });
        waiting.postMessage({ type: 'SKIP_WAITING' });
        setTimeout(resolve, 5000);
      });
    }
  } catch {
    // reload regardless
  }
  window.location.reload();
}

export function initUpdates(): void {
  if (started) return;
  started = true;

  registerSW({
    immediate: true,
    onNeedRefresh: markAvailable,
    onRegisteredSW(_url, reg) {
      registration = reg;
      if (reg) setInterval(() => void reg.update().catch(() => {}), CHECK_EVERY_MS);
    },
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void registration?.update().catch(() => {});
    else if (useUpdate.getState().available && !isTyping()) void applyUpdate();
  });

  getSocket().on('version', (build: unknown) => {
    if (BUILD_ID === 'dev' || typeof build !== 'string' || !build || build === BUILD_ID) return;
    void registration?.update().catch(() => {});
    markAvailable();
  });
}
