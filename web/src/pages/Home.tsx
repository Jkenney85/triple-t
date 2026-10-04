import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Archive, Check, LayoutGrid, RotateCcw } from 'lucide-react';
import { BOARD_THEMES, boardTheme, type Board } from '@triple-t/shared';
import AppHeader from '../components/AppHeader';
import { Button, Popover, cx, inputClass, usePopover } from '../components/ui';
import { ApiError, post } from '../lib/api';
import { useBoard } from '../stores/board';
import { useBoards } from '../stores/boards';
import { toast } from '../stores/ui';

export default function Home() {
  const boards = useBoards((s) => s.boards);
  const loaded = useBoards((s) => s.loaded);
  const create = usePopover();
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    document.title = 'Boards · Triple T';
    useBoard.getState().close();
  }, []);

  const active = boards.filter((b) => !b.archivedAt);
  const archived = boards.filter((b) => b.archivedAt);

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader />
      <main className="px-safe pb-safe mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <h1 className="mb-4 flex items-center gap-2 text-base font-bold">
          <LayoutGrid size={18} /> Your boards
        </h1>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {active.map((b) => (
            <BoardTile key={b.id} board={b} />
          ))}
          <button
            type="button"
            onClick={create.toggle}
            className="flex h-24 items-center justify-center rounded-lg bg-hover text-sm text-ink-subtle hover:brightness-95"
          >
            Create new board
          </button>
        </div>
        {loaded && active.length === 0 && (
          <p className="mt-6 text-sm text-ink-subtle">No boards yet. Create one to start tracking products.</p>
        )}

        {archived.length > 0 && (
          <div className="mt-10">
            <Button tone="subtle" onClick={() => setShowArchived((v) => !v)}>
              <Archive size={15} /> {showArchived ? 'Hide' : 'View'} archived boards ({archived.length})
            </Button>
            {showArchived && (
              <ul className="mt-3 divide-y divide-line rounded-lg border border-line bg-raised">
                {archived.map((b) => (
                  <li key={b.id} className="flex items-center gap-3 px-3 py-2">
                    <span className="h-8 w-12 shrink-0 rounded" style={{ background: boardTheme(b.color).background }} />
                    <Link to={`/b/${b.id}`} className="flex-1 truncate font-medium hover:underline">
                      {b.name}
                    </Link>
                    <Button
                      onClick={async () => {
                        try {
                          await post(`/api/boards/${b.id}/restore`);
                          await useBoards.getState().load();
                        } catch (err) {
                          toast(err instanceof ApiError ? err.message : 'Could not restore board');
                        }
                      }}
                    >
                      <RotateCcw size={14} /> Restore
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </main>
      {create.open && <CreateBoardPopover anchor={create.anchor} onClose={create.close} />}
    </div>
  );
}

function BoardTile({ board }: { board: Board }) {
  return (
    <Link
      to={`/b/${board.id}`}
      className="group relative flex h-24 overflow-hidden rounded-lg p-2.5 text-white shadow-card"
      style={{ background: boardTheme(board.color).background }}
    >
      <span className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/15" />
      <span className="relative line-clamp-2 text-base font-bold drop-shadow-sm">{board.name}</span>
    </Link>
  );
}

export function ThemePicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div className="grid grid-cols-6 gap-1.5">
      {BOARD_THEMES.map((t) => (
        <button
          key={t.id}
          type="button"
          title={t.name}
          aria-label={t.name}
          onClick={() => onChange(t.id)}
          className={cx('relative flex h-9 items-center justify-center rounded text-white', value === t.id && 'ring-2 ring-accent ring-offset-1 ring-offset-raised')}
          style={{ background: t.background }}
        >
          {value === t.id && <Check size={16} />}
        </button>
      ))}
    </div>
  );
}

function CreateBoardPopover({ anchor, onClose }: { anchor: HTMLElement | null; onClose: () => void }) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [color, setColor] = useState('ocean');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const { board } = await post<{ board: Board }>('/api/boards', { name: name.trim(), color });
      await useBoards.getState().load();
      onClose();
      navigate(`/b/${board.id}`);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not create board');
      setBusy(false);
    }
  }

  return (
    <Popover anchor={anchor} onClose={onClose} title="Create board">
      <form onSubmit={submit}>
        <div className="mb-3 flex h-24 items-start rounded-lg p-3" style={{ background: boardTheme(color).background }}>
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 w-10 rounded bg-white/70" style={{ height: 28 + i * 12 }} />
            ))}
          </div>
        </div>
        <p className="mb-1.5 text-xs font-semibold text-ink-subtle">Background</p>
        <ThemePicker value={color} onChange={setColor} />
        <label className="mb-1 mt-3 block text-xs font-semibold text-ink-subtle" htmlFor="board-name">
          Board title
        </label>
        <input id="board-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={80} />
        <p className="mt-2 text-xs text-ink-subtle">Starts with To Do, In Progress and Done lists, plus Views, CTR, Sales and GMV fields.</p>
        <Button tone="primary" type="submit" className="mt-3 w-full" disabled={!name.trim() || busy}>
          Create
        </Button>
      </form>
    </Popover>
  );
}
