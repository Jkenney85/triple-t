import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, Download, LogOut, Monitor, Moon, Sun, UserCog, Users } from 'lucide-react';
import { boardBackground } from '@triple-t/shared';
import { useBoards } from '../stores/boards';
import { useSession } from '../stores/session';
import { useUi, type ThemePref } from '../stores/ui';
import { BUILD_ID } from '../lib/updates';
import GlobalSearch from './GlobalSearch';
import { Avatar, Popover, Wordmark, cx, usePopover } from './ui';

export default function AppHeader({ onDark = false }: { onDark?: boolean }) {
  const me = useSession((s) => s.me);
  const boardsMenu = usePopover();
  const userMenu = usePopover();
  const boards = useBoards((s) => s.boards);
  const navigate = useNavigate();

  useEffect(() => {
    void useBoards.getState().load();
  }, []);

  const btn = onDark ? 'text-white hover:bg-white/20' : 'text-ink hover:bg-hover';

  return (
    <header
      className={cx(
        'pt-safe px-safe relative z-20 shrink-0',
        onDark ? 'bg-black/25 text-white backdrop-blur-sm' : 'border-b border-line bg-raised text-ink',
      )}
    >
      <div className="relative flex h-12 items-center gap-1 px-2 sm:px-3">
        <Link to="/" className={cx('mr-1 flex h-9 items-center rounded px-1.5', btn)}>
          <Wordmark />
        </Link>
        <button type="button" onClick={boardsMenu.toggle} className={cx('flex h-9 items-center gap-1 rounded px-2.5 text-sm font-medium', btn)}>
          Boards <ChevronDown size={16} />
        </button>
        <div className="flex-1" />
        <GlobalSearch onDark={onDark} />
        <button type="button" onClick={userMenu.toggle} className="ml-1 flex h-9 w-9 items-center justify-center rounded-full hover:bg-hover" aria-label="Account">
          <Avatar user={me} size={30} />
        </button>
      </div>

      {boardsMenu.open && (
        <Popover anchor={boardsMenu.anchor} onClose={boardsMenu.close} title="Boards">
          <div className="flex flex-col gap-1">
            {boards
              .filter((b) => !b.archivedAt)
              .map((b) => (
                <button
                  key={b.id}
                  type="button"
                  className="flex min-h-10 items-center gap-3 rounded px-2 text-left text-sm hover:bg-hover"
                  onClick={() => {
                    boardsMenu.close();
                    navigate(`/b/${b.id}`);
                  }}
                >
                  <span className="h-6 w-9 shrink-0 rounded" style={{ background: boardBackground(b, 'thumb') }} />
                  <span className="truncate font-medium">{b.name}</span>
                </button>
              ))}
            <Link to="/" onClick={boardsMenu.close} className="mt-1 rounded px-2 py-2 text-sm text-ink-subtle hover:bg-hover">
              All boards…
            </Link>
          </div>
        </Popover>
      )}

      {userMenu.open && me && (
        <Popover anchor={userMenu.anchor} onClose={userMenu.close} title="Account" width={280}>
          <div className="mb-2 flex items-center gap-3 px-1 py-2">
            <Avatar user={me} size={40} />
            <div className="min-w-0">
              <div className="truncate font-semibold">{me.displayName}</div>
              <div className="truncate text-xs text-ink-subtle">@{me.username}</div>
            </div>
          </div>
          <ThemeSwitch />
          <div className="my-2 border-t border-line" />
          <MenuLink to="/profile" icon={<UserCog size={16} />} onClick={userMenu.close}>
            Profile & password
          </MenuLink>
          {me.isAdmin && (
            <>
              <MenuLink to="/admin/users" icon={<Users size={16} />} onClick={userMenu.close}>
                Manage users
              </MenuLink>
              <a href="/api/admin/export" className="flex min-h-10 items-center gap-3 rounded px-2 text-sm hover:bg-hover" onClick={userMenu.close}>
                <Download size={16} /> Download JSON export
              </a>
            </>
          )}
          <div className="my-2 border-t border-line" />
          <button
            type="button"
            className="flex min-h-10 w-full items-center gap-3 rounded px-2 text-left text-sm hover:bg-hover"
            onClick={() => void useSession.getState().logout()}
          >
            <LogOut size={16} /> Log out
          </button>
          <p className="mt-2 px-2 text-[11px] text-ink-subtle">Version {BUILD_ID === 'dev' ? 'dev' : `${BUILD_ID.slice(0, 8)}-${BUILD_ID.slice(8)}`}</p>
        </Popover>
      )}
    </header>
  );
}

function MenuLink({ to, icon, children, onClick }: { to: string; icon: React.ReactNode; children: React.ReactNode; onClick: () => void }) {
  return (
    <Link to={to} onClick={onClick} className="flex min-h-10 items-center gap-3 rounded px-2 text-sm hover:bg-hover">
      {icon}
      {children}
    </Link>
  );
}

export function ThemeSwitch() {
  const theme = useUi((s) => s.theme);
  const setTheme = useUi((s) => s.setTheme);
  const options: { id: ThemePref; label: string; icon: React.ReactNode }[] = [
    { id: 'light', label: 'Light', icon: <Sun size={15} /> },
    { id: 'dark', label: 'Dark', icon: <Moon size={15} /> },
    { id: 'system', label: 'Auto', icon: <Monitor size={15} /> },
  ];
  return (
    <div className="flex gap-1 rounded-md bg-sunken p-1" role="radiogroup" aria-label="Theme">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={theme === o.id}
          onClick={() => setTheme(o.id)}
          className={cx(
            'flex h-8 flex-1 items-center justify-center gap-1.5 rounded text-xs font-medium',
            theme === o.id ? 'bg-raised shadow-card' : 'text-ink-subtle hover:text-ink',
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}
