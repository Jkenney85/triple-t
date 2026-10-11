import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, CheckCircle2, Circle, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  FIELD_TYPES,
  POSITION_GAP,
  isNumericType,
  colorFill,
  readableTextColor,
  type Board,
  type Column,
  type Field,
  type FieldType,
  type Label,
  type TotalMode,
} from '@triple-t/shared';
import {
  archiveBoard,
  createColumn,
  createField,
  deleteField,
  restoreBoard,
  setDoneColumn,
  updateBoard,
  updateColumn,
  updateField,
} from '../../lib/actions';
import { useBoard } from '../../stores/board';
import { Button, Drawer, IconButton, Popover, confirmDialog, cx, inputClass, usePopover } from '../ui';
import ColumnColorPicker from './ColumnColorPicker';
import { LabelEditor } from './CardPopovers';
import BackgroundPicker from './BackgroundPicker';
import DeleteColumnDialog from './DeleteColumnDialog';

type Tab = 'general' | 'background' | 'lists' | 'labels' | 'fields';

const TYPE_LABEL: Record<FieldType, string> = {
  number: 'Number',
  percent: 'Percent',
  currency: 'Currency (USD)',
  text: 'Text',
  url: 'URL',
  date: 'Date',
};

export default function BoardSettings({ board, onClose }: { board: Board; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('general');
  return (
    <Drawer title="Board settings" onClose={onClose}>
      <div className="mb-4 grid grid-cols-5 gap-1 rounded-md bg-sunken p-1">
        {(['general', 'background', 'lists', 'labels', 'fields'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cx('h-8 rounded text-[11px] font-semibold capitalize', tab === t ? 'bg-raised shadow-card' : 'text-ink-subtle hover:text-ink')}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === 'general' && <General board={board} />}
      {tab === 'background' && <BackgroundPicker board={board} />}
      {tab === 'lists' && <Lists board={board} />}
      {tab === 'labels' && <Labels board={board} />}
      {tab === 'fields' && <Fields board={board} />}
    </Drawer>
  );
}

const sectionTitle = 'mb-1.5 text-xs font-semibold text-ink-subtle';

function General({ board }: { board: Board }) {
  const [name, setName] = useState(board.name);
  useEffect(() => setName(board.name), [board.name]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className={sectionTitle}>Board name</p>
        <input
          className={inputClass}
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name.trim() !== board.name && void updateBoard(board, { name: name.trim() }).catch(() => {})}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
      </div>
      <div className="border-t border-line pt-4">
        {board.archivedAt ? (
          <Button tone="primary" className="w-full" onClick={() => void restoreBoard(board).catch(() => {})}>
            Restore board
          </Button>
        ) : (
          <Button
            className="w-full"
            onClick={async () => {
              const ok = await confirmDialog({
                title: 'Archive this board?',
                message: 'It disappears from your boards list. You can restore it from the home page at any time.',
                confirmLabel: 'Archive board',
              });
              if (ok) void archiveBoard(board).catch(() => {});
            }}
          >
            Archive board
          </Button>
        )}
      </div>
    </div>
  );
}

function Lists({ board }: { board: Board }) {
  const columns = useBoard((s) => s.columns);
  const cards = useBoard((s) => s.cards);
  const sorted = Object.values(columns).sort((a, b) => a.position - b.position);
  const [deleting, setDeleting] = useState<Column | null>(null);
  const [newName, setNewName] = useState('');

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= sorted.length) return;
    const neighbor = sorted[target];
    const beyond = sorted[target + dir];
    const position = beyond ? (neighbor.position + beyond.position) / 2 : neighbor.position + dir * POSITION_GAP;
    void updateColumn(sorted[index], { position }).catch(() => {});
  }

  return (
    <div>
      <p className="mb-3 text-xs text-ink-subtle">
        The <b>Done</b> list is where finished cards go. Moving a card into it clears its day of week.
      </p>
      <ul className="flex flex-col gap-2">
        {sorted.map((col, i) => (
          <li key={col.id} className="flex items-center gap-1 rounded-lg bg-sunken p-1.5">
            <button
              type="button"
              title={col.isDone ? 'This is the Done list' : 'Make this the Done list'}
              aria-label={col.isDone ? 'Done list' : `Make ${col.name} the Done list`}
              onClick={() => !col.isDone && void setDoneColumn(board.id, col.id).catch(() => {})}
              className={cx('flex h-8 w-8 shrink-0 items-center justify-center rounded', col.isDone ? 'text-[#1f845a] dark:text-[#4bce97]' : 'text-ink-subtle hover:bg-hover')}
            >
              {col.isDone ? <CheckCircle2 size={18} /> : <Circle size={18} />}
            </button>
            <ColumnName column={col} />
            <ColumnColorButton column={col} />
            <IconButton label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="disabled:opacity-30">
              <ArrowUp size={15} />
            </IconButton>
            <IconButton label="Move down" disabled={i === sorted.length - 1} onClick={() => move(i, 1)} className="disabled:opacity-30">
              <ArrowDown size={15} />
            </IconButton>
            <IconButton label="Delete list" disabled={col.isDone} onClick={() => setDeleting(col)} className="disabled:opacity-30">
              <Trash2 size={15} />
            </IconButton>
          </li>
        ))}
      </ul>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (newName.trim()) void createColumn(board.id, newName.trim()).then(() => setNewName('')).catch(() => {});
        }}
      >
        <input className={inputClass} placeholder="New list name" value={newName} maxLength={80} onChange={(e) => setNewName(e.target.value)} />
        <Button tone="primary" type="submit" disabled={!newName.trim()}>
          <Plus size={15} /> Add
        </Button>
      </form>
      {deleting && (
        <DeleteColumnDialog
          column={deleting}
          columns={sorted}
          cardCount={Object.values(cards).filter((c) => c.columnId === deleting.id).length}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

function ColumnColorButton({ column }: { column: Column }) {
  const pop = usePopover();
  return (
    <>
      <button
        type="button"
        title="List color"
        aria-label={`Color for ${column.name}`}
        onClick={pop.toggle}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded hover:bg-hover"
      >
        <span
          className={cx('h-4 w-4 rounded-full', !column.color && 'border-2 border-dashed border-ink-subtle/60')}
          style={column.color ? { background: column.color } : undefined}
        />
      </button>
      {pop.open && (
        <Popover anchor={pop.anchor} onClose={pop.close} title="List color">
          <ColumnColorPicker column={column} onDone={pop.close} />
        </Popover>
      )}
    </>
  );
}

function ColumnName({ column }: { column: Column }) {
  const [name, setName] = useState(column.name);
  useEffect(() => setName(column.name), [column.name]);
  return (
    <input
      className="h-8 min-w-0 flex-1 rounded bg-transparent px-2 text-base font-medium outline-none focus:bg-card focus:ring-2 focus:ring-accent sm:text-sm"
      value={name}
      maxLength={80}
      aria-label="List name"
      onChange={(e) => setName(e.target.value)}
      onBlur={() => {
        if (name.trim() && name.trim() !== column.name) void updateColumn(column, { name: name.trim() }).catch(() => {});
        else setName(column.name);
      }}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  );
}

function Labels({ board }: { board: Board }) {
  const labels = useBoard((s) => s.labels);
  const cards = useBoard((s) => s.cards);
  const [editing, setEditing] = useState<Label | 'new' | null>(null);

  if (editing) {
    return <LabelEditor boardId={board.id} label={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />;
  }

  const list = Object.values(labels);
  return (
    <div>
      <p className="mb-3 text-xs text-ink-subtle">Labels belong to this board. Each card can have any number of them.</p>
      {list.length === 0 && <p className="mb-3 text-sm text-ink-subtle">No labels yet.</p>}
      <ul className="flex flex-col gap-1.5">
        {list.map((l) => {
          const uses = Object.values(cards).filter((c) => c.labelIds.includes(l.id)).length;
          return (
            <li key={l.id} className="flex items-center gap-2">
              <span className="flex h-8 flex-1 items-center truncate rounded px-3 text-sm font-semibold" style={{ background: colorFill(l.color), color: readableTextColor(l.color) }}>
                {l.name || ' '}
              </span>
              <span className="w-14 text-right text-xs text-ink-subtle">
                {uses} card{uses === 1 ? '' : 's'}
              </span>
              <IconButton label={`Edit ${l.name}`} onClick={() => setEditing(l)}>
                <Pencil size={14} />
              </IconButton>
            </li>
          );
        })}
      </ul>
      <Button className="mt-3 w-full" onClick={() => setEditing('new')}>
        <Plus size={15} /> Create a label
      </Button>
    </div>
  );
}

function Fields({ board }: { board: Board }) {
  const fields = useBoard((s) => s.fields);
  const sorted = Object.values(fields).sort((a, b) => a.position - b.position);
  const [name, setName] = useState('');
  const [type, setType] = useState<FieldType>('number');

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= sorted.length) return;
    const neighbor = sorted[target];
    const beyond = sorted[target + dir];
    const position = beyond ? (neighbor.position + beyond.position) / 2 : neighbor.position + dir * POSITION_GAP;
    void updateField(sorted[index], { position }).catch(() => {});
  }

  return (
    <div>
      <p className="mb-3 text-xs text-ink-subtle">
        Metric fields are filled in per video. Cards show totals across their videos; fields marked <b>On card</b> also show as badges on the board.
      </p>
      <ul className="flex flex-col gap-3">
        {sorted.map((f, i) => (
          <FieldRow key={f.id} field={f} first={i === 0} last={i === sorted.length - 1} onMove={(d) => move(i, d)} />
        ))}
      </ul>
      <form
        className="mt-4 rounded-lg border border-dashed border-line p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          void createField(board.id, { name: name.trim(), type, showOnFront: false })
            .then(() => setName(''))
            .catch(() => {});
        }}
      >
        <p className={sectionTitle}>Add a field</p>
        <div className="flex gap-2">
          <input className={inputClass} placeholder="Field name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
          <select className={inputClass + ' w-32 shrink-0'} value={type} onChange={(e) => setType(e.target.value as FieldType)}>
            {FIELD_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        <Button tone="primary" type="submit" className="mt-2 w-full" disabled={!name.trim()}>
          Add field
        </Button>
      </form>
    </div>
  );
}

function FieldRow({ field, first, last, onMove }: { field: Field; first: boolean; last: boolean; onMove: (d: -1 | 1) => void }) {
  const [name, setName] = useState(field.name);
  useEffect(() => setName(field.name), [field.name]);
  const numeric = isNumericType(field.type);

  return (
    <li className="rounded-lg bg-sunken p-2.5">
      <div className="flex items-center gap-1">
        <input
          className="h-8 min-w-0 flex-1 rounded bg-transparent px-2 text-base font-semibold outline-none focus:bg-card focus:ring-2 focus:ring-accent sm:text-sm"
          value={name}
          aria-label="Field name"
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            if (name.trim() && name.trim() !== field.name) void updateField(field, { name: name.trim() }).catch(() => {});
            else setName(field.name);
          }}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
        <IconButton label="Move up" disabled={first} onClick={() => onMove(-1)} className="disabled:opacity-30">
          <ArrowUp size={15} />
        </IconButton>
        <IconButton label="Move down" disabled={last} onClick={() => onMove(1)} className="disabled:opacity-30">
          <ArrowDown size={15} />
        </IconButton>
        <IconButton
          label="Delete field"
          onClick={async () => {
            const ok = await confirmDialog({
              title: `Delete “${field.name}”?`,
              message: 'Its values on every video are deleted too. This can’t be undone.',
              confirmLabel: 'Delete field',
              danger: true,
            });
            if (ok) void deleteField(field).catch(() => {});
          }}
        >
          <Trash2 size={15} />
        </IconButton>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="text-xs text-ink-subtle">
          Type
          <select
            className={inputClass + ' mt-0.5 h-9'}
            value={field.type}
            onChange={(e) => void updateField(field, { type: e.target.value as FieldType }).catch(() => {})}
          >
            {FIELD_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-ink-subtle">
          Card total
          <select
            className={inputClass + ' mt-0.5 h-9'}
            value={field.totalMode}
            disabled={!numeric}
            onChange={(e) => void updateField(field, { totalMode: e.target.value as TotalMode }).catch(() => {})}
          >
            <option value="sum">Sum</option>
            <option value="avg">Average</option>
            <option value="none">None</option>
          </select>
        </label>
      </div>
      <label className="mt-2 flex min-h-8 cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="h-4 w-4 accent-[var(--accent)]"
          checked={field.showOnFront}
          onChange={(e) => void updateField(field, { showOnFront: e.target.checked }).catch(() => {})}
        />
        On card <span className="text-xs text-ink-subtle">(show the total as a badge on the board)</span>
      </label>
    </li>
  );
}
