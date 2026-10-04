import { create } from 'zustand';

export type ThemePref = 'light' | 'dark' | 'system';

interface Toast {
  id: number;
  message: string;
  tone: 'error' | 'info';
}

interface UiState {
  theme: ThemePref;
  toasts: Toast[];
  setTheme(theme: ThemePref): void;
  toast(message: string, tone?: Toast['tone']): void;
  dismiss(id: number): void;
}

function readTheme(): ThemePref {
  try {
    const v = localStorage.getItem('ttt-theme');
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

const media = window.matchMedia('(prefers-color-scheme: dark)');

function applyTheme(pref: ThemePref) {
  const dark = pref === 'dark' || (pref === 'system' && media.matches);
  document.documentElement.classList.toggle('dark', dark);
}

let nextToast = 1;

export const useUi = create<UiState>((set, get) => ({
  theme: readTheme(),
  toasts: [],
  setTheme(theme) {
    try {
      localStorage.setItem('ttt-theme', theme);
    } catch {
      // storage unavailable (private mode); theme still applies for this session
    }
    applyTheme(theme);
    set({ theme });
  },
  toast(message, tone = 'error') {
    const id = nextToast++;
    set((s) => ({ toasts: [...s.toasts, { id, message, tone }] }));
    setTimeout(() => get().dismiss(id), 5000);
  },
  dismiss(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));

media.addEventListener('change', () => applyTheme(useUi.getState().theme));
applyTheme(useUi.getState().theme);

export const toast = (message: string, tone?: Toast['tone']) => useUi.getState().toast(message, tone);
