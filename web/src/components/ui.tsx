import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { create } from 'zustand';
import { initials, type PublicUser } from '@triple-t/shared';
import { useConnection } from '../lib/socket';
import { applyUpdate, useUpdate } from '../lib/updates';
import { useUi } from '../stores/ui';

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

// ---- Brand ----

export function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden>
      <defs>
        <linearGradient id="ttt-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5b4bdb" />
          <stop offset="1" stopColor="#1fb5c4" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="116" fill="url(#ttt-g)" />
      <g fill="#fff">
        <rect x="76" y="132" width="112" height="40" rx="16" />
        <rect x="114" y="132" width="36" height="232" rx="16" />
        <rect x="200" y="132" width="112" height="40" rx="16" />
        <rect x="238" y="132" width="36" height="172" rx="16" />
        <rect x="324" y="132" width="112" height="40" rx="16" />
        <rect x="362" y="132" width="36" height="268" rx="16" />
      </g>
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cx('flex items-center gap-2 font-bold tracking-tight', className)}>
      <LogoMark size={22} />
      <span className="text-[17px] leading-none">
        Triple<span className="ml-[3px] opacity-80">T</span>
      </span>
    </span>
  );
}

// ---- Avatar ----

export function Avatar({ user, size = 28, title }: { user?: Pick<PublicUser, 'displayName' | 'avatarColor'> | null; size?: number; title?: string }) {
  const name = user?.displayName ?? 'Unknown';
  return (
    <span
      title={title ?? name}
      className="inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, background: user?.avatarColor ?? '#626f86', fontSize: Math.max(10, size * 0.4) }}
    >
      {initials(name)}
    </span>
  );
}

// ---- Buttons ----

type ButtonTone = 'primary' | 'subtle' | 'danger' | 'ghost';

export function Button({
  tone = 'subtle',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: ButtonTone }) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        'inline-flex min-h-8 items-center justify-center gap-1.5 rounded-[3px] px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        tone === 'primary' && 'bg-accent text-accent-ink hover:brightness-110',
        tone === 'subtle' && 'bg-hover text-ink hover:bg-[color-mix(in_srgb,var(--hover)_200%,transparent)]',
        tone === 'danger' && 'bg-danger text-white hover:brightness-110',
        tone === 'ghost' && 'text-ink hover:bg-hover',
        className,
      )}
    />
  );
}

export function IconButton({ label, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...props}
      className={cx('inline-flex h-8 w-8 items-center justify-center rounded-[3px] text-ink-subtle hover:bg-hover hover:text-ink', className)}
    />
  );
}

export const inputClass =
  'w-full rounded-[3px] border-2 border-line bg-card px-2 py-1.5 text-base text-ink outline-none sm:text-sm placeholder:text-ink-subtle/70 focus:border-accent';

// ---- Modal ----

export function Modal({
  open,
  onClose,
  children,
  width = 'max-w-[768px]',
  label,
  align = 'top',
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  width?: string;
  label: string;
  align?: 'top' | 'center';
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('[data-popover]')) onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div
      className={cx(
        'fixed inset-0 z-40 flex justify-center overflow-y-auto bg-black/60 sm:px-4',
        align === 'top' ? 'items-start sm:py-12' : 'items-center sm:py-8',
      )}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={cx(
          'animate-pop relative min-h-full w-full bg-raised text-ink shadow-pop max-sm:pt-[env(safe-area-inset-top)] sm:min-h-0 sm:rounded-xl',
          width,
        )}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function ModalClose({ onClose, className }: { onClose: () => void; className?: string }) {
  return (
    <IconButton
      label="Close"
      onClick={onClose}
      className={cx('absolute right-2 top-2 z-10 h-10 w-10 rounded-full max-sm:top-[calc(env(safe-area-inset-top)+8px)]', className)}
    >
      <X size={20} />
    </IconButton>
  );
}

// ---- Popover ----

/**
 * Small floating panel anchored below an element (Trello's pop-overs).
 * On phones it docks to the bottom of the screen as a sheet.
 */
export function Popover({
  anchor,
  onClose,
  title,
  children,
  width = 304,
}: {
  anchor: HTMLElement | null;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const isPhone = window.matchMedia('(max-width: 640px)').matches;

  useLayoutEffect(() => {
    if (!anchor || isPhone) return;
    const place = () => {
      const r = anchor.getBoundingClientRect();
      const h = ref.current?.offsetHeight ?? 300;
      let top = r.bottom + 6;
      if (top + h > window.innerHeight - 8) top = Math.max(8, window.innerHeight - h - 8);
      const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
      setPos({ top, left });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [anchor, width, isPhone]);

  useEffect(() => {
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || anchor?.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [anchor, onClose]);

  return createPortal(
    <>
      {isPhone && <div className="fixed inset-0 z-50 bg-black/40" />}
      <div
        ref={ref}
        data-popover
        role="dialog"
        aria-label={title}
        className={cx(
          'animate-pop z-50 bg-raised text-ink shadow-pop',
          isPhone ? 'pb-safe fixed inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl' : 'fixed max-h-[80vh] overflow-y-auto rounded-lg',
        )}
        style={isPhone ? undefined : { top: pos?.top ?? -9999, left: pos?.left ?? -9999, width }}
      >
        <div className="relative flex h-10 items-center justify-center px-10 text-sm font-semibold text-ink-subtle">
          {title}
          <IconButton label="Close" onClick={onClose} className="absolute right-1 top-1">
            <X size={16} />
          </IconButton>
        </div>
        <div className="px-3 pb-3">{children}</div>
      </div>
    </>,
    document.body,
  );
}

/** Convenience: manages the anchor element for a popover trigger. */
export function usePopover() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return {
    anchor,
    open: !!anchor,
    toggle: (e: React.MouseEvent<HTMLElement>) => {
      const el = e.currentTarget;
      setAnchor((a) => (a ? null : el));
    },
    close: () => setAnchor(null),
  };
}

// ---- Confirm dialog ----

interface ConfirmRequest {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  resolve: (ok: boolean) => void;
}

const useConfirmStore = create<{ req: ConfirmRequest | null }>(() => ({ req: null }));

export function confirmDialog(opts: Omit<ConfirmRequest, 'resolve'>): Promise<boolean> {
  return new Promise((resolve) => useConfirmStore.setState({ req: { ...opts, resolve } }));
}

export function ConfirmHost() {
  const req = useConfirmStore((s) => s.req);
  const finish = (ok: boolean) => {
    req?.resolve(ok);
    useConfirmStore.setState({ req: null });
  };
  return (
    <Modal open={!!req} onClose={() => finish(false)} width="max-w-sm" label={req?.title ?? 'Confirm'} align="center">
      {req && (
        <div className="p-5">
          <h2 className="pr-8 text-base font-semibold">{req.title}</h2>
          {req.message && <div className="mt-2 text-sm text-ink-subtle">{req.message}</div>}
          <div className="mt-5 flex justify-end gap-2">
            <Button onClick={() => finish(false)}>Cancel</Button>
            <Button tone={req.danger ? 'danger' : 'primary'} onClick={() => finish(true)} autoFocus>
              {req.confirmLabel ?? 'Confirm'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ---- Toasts & connection state ----

export function Toasts() {
  const toasts = useUi((s) => s.toasts);
  const dismiss = useUi((s) => s.dismiss);
  return (
    <div className="pb-safe pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={cx(
            'animate-pop pointer-events-auto max-w-md rounded-lg px-4 py-2.5 text-left text-sm font-medium text-white shadow-pop',
            t.tone === 'error' ? 'bg-[#ae2e24]' : 'bg-[#172b4d] dark:bg-[#38414a]',
          )}
        >
          {t.message}
        </button>
      ))}
    </div>
  );
}

export function ConnectionBanner() {
  const status = useConnection((s) => s.status);
  if (status === 'online' || status === 'connecting') return null;
  return (
    <div
      role="status"
      className="pt-safe fixed inset-x-0 top-0 z-[55] flex justify-center"
    >
      <div className="mt-2 flex items-center gap-2 rounded-full bg-[#7f5f01] px-4 py-1.5 text-sm font-semibold text-white shadow-pop">
        <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
        {status === 'offline' ? "You're offline — reconnecting when you're back…" : 'Reconnecting…'}
      </div>
    </div>
  );
}

// ---- Drawer (board menu, archived items) ----

export function Drawer({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('[data-popover]') && !document.querySelector('[role="dialog"][aria-modal]')) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <>
      <div className="fixed inset-0 z-30 bg-black/30 sm:bg-transparent" onMouseDown={onClose} />
      <aside
        role="dialog"
        aria-label={title}
        className="animate-pop pt-safe pb-safe fixed inset-y-0 right-0 z-30 flex w-full flex-col bg-raised text-ink shadow-pop sm:w-[380px]"
      >
        <div className="relative flex h-12 shrink-0 items-center justify-center border-b border-line px-12 font-semibold">
          {title}
          <IconButton label="Close" onClick={onClose} className="absolute right-2 top-2">
            <X size={18} />
          </IconButton>
        </div>
        <div className="flex-1 overflow-y-auto p-3">{children}</div>
      </aside>
    </>,
    document.body,
  );
}

/** Shown when a newer version of the app has been deployed. */
export function UpdateBanner() {
  const { available, applying } = useUpdate();
  if (!available) return null;
  return (
    <div role="status" className="pb-safe pointer-events-none fixed inset-x-0 bottom-4 z-[58] flex justify-center px-4 sm:justify-start">
      <div className="animate-pop pointer-events-auto flex items-center gap-3 rounded-lg bg-[#172b4d] py-2 pl-4 pr-2 text-sm text-white shadow-pop dark:bg-[#38414a]">
        <span>A new version of Triple T is ready.</span>
        <button
          type="button"
          disabled={applying}
          onClick={() => void applyUpdate()}
          className="h-8 rounded bg-[#579dff] px-3 font-semibold text-[#1d2125] hover:brightness-110 disabled:opacity-70"
        >
          {applying ? 'Updating…' : 'Reload'}
        </button>
      </div>
    </div>
  );
}
