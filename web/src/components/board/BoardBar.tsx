import { useEffect, useMemo, useState } from 'react';
import { Archive, Check, Filter, Settings } from 'lucide-react';
import {
  DAY_SHORT,
  EMPTY_FILTER,
  activeFilterCount,
  readableTextColor,
  type Board,
  type CardFilter,
} from '@triple-t/shared';
import { updateBoard } from '../../lib/actions';
import { useBoard } from '../../stores/board';
import { useSession } from '../../stores/session';
import { Avatar, Button, Popover, cx, inputClass, usePopover } from '../ui';

export default function BoardBar({
  board,
  filter,
  onFilter,
  onOpenPanel,
}: {
  board: Board;
  filter: CardFilter;
  onFilter: (f: CardFilter) => void;
  onOpenPanel: (p: 'settings' | 'archived') => void;
}) {
  const presence = useBoard((s) => s.presence);
  const me = useSession((s) => s.me);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(board.name);
  const filterPop = usePopover();
  const count = activeFilterCount(filter);

  useEffect(() => {
    if (!editing) setName(board.name);
  }, [board.name, editing]);

  function save() {
    setEditing(false);
    const n = name.trim();
    if (n && n !== board.name) void updateBoard(board, { name: n }).catch(() => {});
    else setName(board.name);
  }

  const others = presence.filter((u) => u.id !== me?.id);
  const btn = 'flex h-9 items-center gap-1.5 rounded px-2.5 text-sm font-medium text-white hover:bg-white/20';

  return (
    <div className="px-safe flex min-h-12 shrink-0 items-center gap-1 bg-black/15 px-2 py-1.5 text-white sm:px-3">
      {editing ? (
        <input
          autoFocus
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') {
              setName(board.name);
              setEditing(false);
            }
          }}
          className="h-9 min-w-0 rounded bg-raised px-2 text-lg font-bold text-ink outline-none ring-2 ring-accent"
        />
      ) : (
        <button type="button" onClick={() => setEditing(true)} className="min-w-0 truncate rounded px-2 py-1 text-lg font-bold hover:bg-white/20">
          {board.name}
        </button>
      )}
      <div className="flex-1" />

      {others.length > 0 && (
        <div className="mr-1 flex items-center -space-x-1.5" aria-label="Also viewing this board">
          {others.slice(0, 5).map((u) => (
            <span key={u.id} className="rounded-full ring-2 ring-black/20">
              <Avatar user={u} size={28} title={`${u.displayName} is viewing`} />
            </span>
          ))}
          {others.length > 5 && <span className="pl-3 text-xs">+{others.length - 5}</span>}
        </div>
      )}

      <button type="button" className={cx(btn, count > 0 && 'bg-white/90 text-[#172b4d] hover:bg-white')} onClick={filterPop.toggle}>
        <Filter size={16} />
        <span className="hidden sm:inline">Filter</span>
        {count > 0 && <span className="rounded-full bg-[#0c66e4] px-1.5 text-xs text-white">{count}</span>}
      </button>
      <button type="button" className={btn} onClick={() => onOpenPanel('archived')} title="Archived items">
        <Archive size={16} />
        <span className="hidden md:inline">Archived</span>
      </button>
      <button type="button" className={btn} onClick={() => onOpenPanel('settings')} title="Board settings">
        <Settings size={16} />
        <span className="hidden md:inline">Settings</span>
      </button>

      {filterPop.open && (
        <Popover anchor={filterPop.anchor} onClose={filterPop.close} title="Filter cards" width={340}>
          <FilterForm filter={filter} onChange={onFilter} />
        </Popover>
      )}
    </div>
  );
}

function Check2({ checked }: { checked: boolean }) {
  return (
    <span
      className={cx(
        'flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border-2',
        checked ? 'border-accent bg-accent text-accent-ink' : 'border-ink-subtle/60',
      )}
    >
      {checked && <Check size={12} strokeWidth={3} />}
    </span>
  );
}

function Row({ checked, onToggle, children }: { checked: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onToggle} className="flex min-h-9 w-full items-center gap-2.5 rounded px-1.5 text-left text-sm hover:bg-hover">
      <Check2 checked={checked} />
      {children}
    </button>
  );
}

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

function FilterForm({ filter, onChange }: { filter: CardFilter; onChange: (f: CardFilter) => void }) {
  const labels = useBoard((s) => s.labels);
  const cards = useBoard((s) => s.cards);
  const bannerColors = useMemo(
    () => [...new Set(Object.values(cards).map((c) => c.bannerColor).filter((c): c is string => !!c))],
    [cards],
  );
  const set = (patch: Partial<CardFilter>) => onChange({ ...filter, ...patch });
  const heading = 'mb-1 mt-3 text-xs font-semibold text-ink-subtle';

  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-ink-subtle">Keyword</p>
      <input
        className={inputClass}
        placeholder="Title, notes, banner or comments…"
        value={filter.text}
        onChange={(e) => set({ text: e.target.value })}
        autoFocus
      />

      {Object.keys(labels).length > 0 && (
        <>
          <p className={heading}>Labels</p>
          {Object.values(labels).map((l) => (
            <Row key={l.id} checked={filter.labelIds.includes(l.id)} onToggle={() => set({ labelIds: toggle(filter.labelIds, l.id) })}>
              <span
                className="flex h-7 flex-1 items-center truncate rounded px-2 text-xs font-semibold"
                style={{ background: l.color, color: readableTextColor(l.color) }}
              >
                {l.name || ' '}
              </span>
            </Row>
          ))}
        </>
      )}

      <p className={heading}>Day of week</p>
      <div className="flex flex-wrap gap-1">
        {[...DAY_SHORT, 'No day'].map((d, i) => (
          <button
            key={d}
            type="button"
            onClick={() => set({ days: toggle(filter.days, i) })}
            className={cx(
              'h-8 rounded px-2.5 text-xs font-semibold',
              filter.days.includes(i) ? 'bg-accent text-accent-ink' : 'bg-hover text-ink hover:brightness-95',
            )}
          >
            {d}
          </button>
        ))}
      </div>

      {bannerColors.length > 0 && (
        <>
          <p className={heading}>Banner color</p>
          <div className="flex flex-wrap gap-1.5">
            {bannerColors.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Banner ${c}`}
                onClick={() => set({ bannerColors: toggle(filter.bannerColors, c) })}
                className={cx('flex h-8 w-10 items-center justify-center rounded', filter.bannerColors.includes(c) && 'ring-2 ring-accent ring-offset-2 ring-offset-raised')}
                style={{ background: c, color: readableTextColor(c) }}
              >
                {filter.bannerColors.includes(c) && <Check size={14} />}
              </button>
            ))}
          </div>
        </>
      )}

      <p className={heading}>Due date</p>
      <Row checked={filter.due.includes('overdue')} onToggle={() => set({ due: toggle(filter.due, 'overdue') })}>
        <span className="h-3 w-3 rounded-full bg-[#c9372c]" /> Overdue
      </Row>
      <Row checked={filter.due.includes('soon')} onToggle={() => set({ due: toggle(filter.due, 'soon') })}>
        <span className="h-3 w-3 rounded-full bg-[#f5cd47]" /> Due in the next day
      </Row>
      <Row checked={filter.due.includes('none')} onToggle={() => set({ due: toggle(filter.due, 'none') })}>
        <span className="h-3 w-3 rounded-full border border-ink-subtle" /> No due date
      </Row>

      <p className={heading}>Videos</p>
      <div className="flex gap-1">
        {(['any', 'with', 'without'] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => set({ videos: v })}
            className={cx('h-8 flex-1 rounded text-xs font-semibold', filter.videos === v ? 'bg-accent text-accent-ink' : 'bg-hover text-ink')}
          >
            {v === 'any' ? 'Any' : v === 'with' ? 'Has videos' : 'No videos'}
          </button>
        ))}
      </div>

      <Button className="mt-4 w-full" onClick={() => onChange(EMPTY_FILTER)} disabled={activeFilterCount(filter) === 0}>
        Clear filters
      </Button>
    </div>
  );
}
