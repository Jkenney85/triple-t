import { useEffect, useRef, useState } from 'react';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowDownAZ, CalendarClock, CalendarDays, Check, CheckCircle2, MoreHorizontal, Plus, X } from 'lucide-react';
import { COLUMN_SORTS, COLUMN_SORT_LABELS, type Column, type ColumnSort } from '@triple-t/shared';
import { createCard, setDoneColumn, updateColumn } from '../../lib/actions';
import { Button, IconButton, Popover, cx, usePopover } from '../ui';
import { CardFront, type CardFrontData } from './CardFront';
import ColumnColorPicker, { columnBackground } from './ColumnColorPicker';

export const colKey = (id: number) => `col-${id}`;
export const cardKey = (id: number) => `card-${id}`;

export function ColumnView({
  column,
  cardIds,
  cardData,
  totalCount,
  onOpenCard,
  onDeleteColumn,
  dragDisabled,
}: {
  column: Column;
  cardIds: number[];
  cardData: Record<number, CardFrontData>;
  totalCount: number;
  onOpenCard: (id: number) => void;
  onDeleteColumn: (column: Column) => void;
  dragDisabled?: boolean;
}) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: colKey(column.id),
    data: { type: 'column' },
    disabled: dragDisabled,
  });
  const [composing, setComposing] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition, background: columnBackground(column.color) }}
      className={cx(
        'flex max-h-full w-[85vw] shrink-0 snap-start flex-col self-start rounded-xl bg-list text-ink shadow-card sm:w-[272px]',
        isDragging && 'opacity-40',
      )}
    >
      <ColumnHeader
        column={column}
        count={totalCount}
        dragProps={{ ...attributes, ...listeners }}
        onAddCard={() => setComposing(true)}
        onDelete={() => onDeleteColumn(column)}
      />
      <div ref={listRef} className="list-scroll flex min-h-1 flex-col gap-2 overflow-y-auto overflow-x-hidden px-2 pb-1 pt-0.5">
        <SortableContext items={cardIds.map(cardKey)} strategy={verticalListSortingStrategy}>
          {cardIds.map((id) => (cardData[id] ? <SortableCard key={id} data={cardData[id]} onOpen={onOpenCard} disabled={dragDisabled} /> : null))}
        </SortableContext>
        {composing && (
          <CardComposer
            column={column}
            onClose={() => setComposing(false)}
            onAdded={() => requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }))}
          />
        )}
      </div>
      {!composing && (
        <div className="px-2 pb-2 pt-1">
          <button
            type="button"
            onClick={() => setComposing(true)}
            className="flex h-10 w-full items-center gap-2 rounded-lg px-2 text-sm font-medium text-ink-subtle hover:bg-hover hover:text-ink sm:h-8"
          >
            <Plus size={16} /> Add a card
          </button>
        </div>
      )}
    </div>
  );
}

function ColumnHeader({
  column,
  count,
  dragProps,
  onAddCard,
  onDelete,
}: {
  column: Column;
  count: number;
  dragProps: Record<string, unknown>;
  onAddCard: () => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(column.name);
  const menu = usePopover();
  const [menuView, setMenuView] = useState<'actions' | 'color' | 'sort'>('actions');

  useEffect(() => {
    if (!menu.open) setMenuView('actions');
  }, [menu.open]);

  useEffect(() => {
    if (!editing) setName(column.name);
  }, [column.name, editing]);

  function save() {
    setEditing(false);
    const next = name.trim();
    if (next && next !== column.name) void updateColumn(column, { name: next }).catch(() => {});
    else setName(column.name);
  }

  return (
    <div className="flex items-start gap-1 px-2 pb-1 pt-2" {...(editing ? {} : dragProps)} style={{ touchAction: 'manipulation' }}>
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
              setName(column.name);
              setEditing(false);
            }
          }}
          className="h-8 flex-1 rounded-[3px] border-2 border-accent bg-card px-2 text-sm font-semibold outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex min-h-8 flex-1 items-center gap-1.5 rounded px-2 text-left text-sm font-semibold"
        >
          <span className="break-words">{column.name}</span>
          {column.isDone && <CheckCircle2 size={14} className="shrink-0 text-[#1f845a] dark:text-[#4bce97]" aria-label="Done list" />}
          {column.sort !== 'day' && (
            <span
              className="flex shrink-0 items-center gap-0.5 rounded bg-hover px-1 text-[10px] font-semibold uppercase tracking-wide text-ink-subtle"
              title={`Sorted by ${COLUMN_SORT_LABELS[column.sort].toLowerCase()}`}
            >
              {column.sort === 'title' ? <ArrowDownAZ size={11} /> : <CalendarClock size={11} />}
              {column.sort === 'title' ? 'A–Z' : 'Due'}
            </span>
          )}
          <span className="ml-auto pl-1 text-xs font-normal text-ink-subtle">{count}</span>
        </button>
      )}
      <IconButton label="List actions" onClick={menu.toggle} onPointerDown={(e) => e.stopPropagation()}>
        <MoreHorizontal size={16} />
      </IconButton>
      {menu.open && (
        <Popover anchor={menu.anchor} onClose={menu.close} title={menuView === 'color' ? 'List color' : menuView === 'sort' ? 'Sort cards by' : 'List actions'}>
          {menuView === 'color' ? (
            <ColumnColorPicker column={column} />
          ) : menuView === 'sort' ? (
            <SortPicker column={column} onDone={menu.close} />
          ) : (
          <>
          <MenuItem
            onClick={() => {
              menu.close();
              onAddCard();
            }}
          >
            Add card
          </MenuItem>
          <MenuItem
            onClick={() => {
              menu.close();
              setEditing(true);
            }}
          >
            Rename list
          </MenuItem>
          <MenuItem onClick={() => setMenuView('sort')}>
            <span className="flex-1">Sort cards by</span>
            <span className="text-xs text-ink-subtle">{COLUMN_SORT_LABELS[column.sort]}</span>
          </MenuItem>
          <MenuItem onClick={() => void updateColumn(column, { highlightDue: !column.highlightDue }).catch(() => {})}>
            <span className="flex-1">Outline cards with a due date</span>
            <span
              role="switch"
              aria-checked={column.highlightDue}
              className={cx('relative h-5 w-9 shrink-0 rounded-full transition-colors', column.highlightDue ? 'bg-[#ffe500]' : 'bg-ink-subtle/30')}
            >
              <span className={cx('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-[left]', column.highlightDue ? 'left-[18px]' : 'left-0.5')} />
            </span>
          </MenuItem>
          <MenuItem onClick={() => setMenuView('color')}>
            <span className="flex-1">List color</span>
            <span
              className="h-4 w-6 rounded-sm border border-line"
              style={{ background: column.color ?? 'transparent' }}
              aria-label={column.color ? `Current color ${column.color}` : 'No color'}
            />
          </MenuItem>
          {!column.isDone && (
            <MenuItem
              onClick={() => {
                menu.close();
                void setDoneColumn(column.boardId, column.id).catch(() => {});
              }}
            >
              Make this the Done list
            </MenuItem>
          )}
          <div className="my-1 border-t border-line" />
          <MenuItem
            disabled={column.isDone}
            onClick={() => {
              menu.close();
              onDelete();
            }}
          >
            Delete list…
          </MenuItem>
          {column.isDone && <p className="px-2 pb-1 text-xs text-ink-subtle">Make another list the Done list before deleting this one.</p>}
          </>
          )}
        </Popover>
      )}
    </div>
  );
}

export function MenuItem({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex min-h-10 w-full items-center rounded px-2 text-left text-sm hover:bg-hover disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-8"
    >
      {children}
    </button>
  );
}

function SortableCard({ data, onOpen, disabled }: { data: CardFrontData; onOpen: (id: number) => void; disabled?: boolean }) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: cardKey(data.card.id),
    data: { type: 'card' },
    disabled,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      aria-label={data.card.title}
      onClick={() => onOpen(data.card.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpen(data.card.id);
        else listeners?.onKeyDown?.(e);
      }}
      className={cx(
        'cursor-pointer select-none rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent [-webkit-touch-callout:none]',
        isDragging && 'opacity-0',
      )}
    >
      {isDragging ? <div className="h-16 rounded-lg bg-black/10" /> : <CardFront data={data} />}
    </div>
  );
}

function CardComposer({ column, onClose, onAdded }: { column: Column; onClose: () => void; onAdded: () => void }) {
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  async function submit() {
    const t = title.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      await createCard(column.boardId, column.id, { title: t });
      setTitle('');
      onAdded();
    } catch {
      // toast already shown
    } finally {
      setBusy(false);
      ref.current?.focus();
    }
  }

  return (
    <div className="pb-1">
      <textarea
        ref={ref}
        autoFocus
        rows={2}
        value={title}
        maxLength={300}
        placeholder="Enter a title for this card…"
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            void submit();
          }
          if (e.key === 'Escape') onClose();
        }}
        onBlur={(e) => {
          // Close when focus leaves the composer entirely and nothing was typed.
          if (!title.trim() && !e.currentTarget.parentElement?.contains(e.relatedTarget as Node)) onClose();
        }}
        className="block w-full resize-none rounded-lg bg-card px-3 py-2 text-base text-ink shadow-card outline-none placeholder:text-ink-subtle sm:text-sm"
      />
      <div className="mt-2 flex items-center gap-1">
        <Button tone="primary" onClick={() => void submit()} disabled={!title.trim() || busy}>
          Add card
        </Button>
        <IconButton label="Cancel" onClick={onClose}>
          <X size={18} />
        </IconButton>
      </div>
    </div>
  );
}

const SORT_HELP: Record<ColumnSort, string> = {
  day: 'Sunday to Saturday, then cards with no day. Drag to reorder within a day.',
  title: 'Alphabetical by title. Order is automatic.',
  due: 'Soonest due date first; cards without one at the bottom. Order is automatic.',
};

const SORT_ICON: Record<ColumnSort, React.ReactNode> = {
  day: <CalendarDays size={16} />,
  title: <ArrowDownAZ size={16} />,
  due: <CalendarClock size={16} />,
};

function SortPicker({ column, onDone }: { column: Column; onDone: () => void }) {
  return (
    <div className="flex flex-col gap-1" role="radiogroup" aria-label="Sort cards by">
      {COLUMN_SORTS.map((sort) => (
        <button
          key={sort}
          type="button"
          role="radio"
          aria-checked={column.sort === sort}
          onClick={() => {
            if (sort !== column.sort) void updateColumn(column, { sort }).catch(() => {});
            onDone();
          }}
          className={cx(
            'flex items-start gap-2.5 rounded px-2 py-2 text-left',
            column.sort === sort ? 'bg-accent/15' : 'hover:bg-hover',
          )}
        >
          <span className="mt-0.5 text-ink-subtle">{SORT_ICON[sort]}</span>
          <span className="flex-1">
            <span className="block text-sm font-medium">{COLUMN_SORT_LABELS[sort]}</span>
            <span className="block text-xs text-ink-subtle">{SORT_HELP[sort]}</span>
          </span>
          {column.sort === sort && <Check size={16} className="mt-0.5 text-accent" />}
        </button>
      ))}
    </div>
  );
}
