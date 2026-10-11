import { useEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, Pencil } from 'lucide-react';
import {
  BANNER_SWATCHES,
  DAYS,
  LABEL_COLORS,
  LABEL_GRADIENTS,
  gradientValue,
  isHexColor,
  parseGradientValue,
  colorFill,
  readableTextColor,
  type Card,
  type Label,
} from '@triple-t/shared';
import { createLabel, deleteLabel, updateCard, updateLabel } from '../../lib/actions';
import { toLocalInput } from '../../lib/format';
import { useBoard } from '../../stores/board';
import { Button, Popover, confirmDialog, cx, inputClass } from '../ui';
import { Banner } from './CardFront';

interface PopProps {
  card: Card;
  anchor: HTMLElement | null;
  onClose: () => void;
}

function Swatches({
  colors,
  value,
  onPick,
  columns = 5,
  compact,
}: {
  colors: string[];
  value: string | null;
  onPick: (c: string) => void;
  columns?: 5 | 10;
  compact?: boolean;
}) {
  return (
    <div className={cx('grid', columns === 10 ? 'grid-cols-10 gap-1' : 'grid-cols-5 gap-1.5')}>
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={c.startsWith('gradient:') ? `Gradient ${c.split(':')[1]} to ${c.split(':')[2]}` : c}
          aria-pressed={value === c}
          onClick={() => onPick(c)}
          className={cx(
            'flex items-center justify-center rounded',
            compact ? 'h-7' : 'h-8',
            value === c && 'ring-2 ring-accent ring-offset-2 ring-offset-raised',
          )}
          style={{ background: colorFill(c), color: readableTextColor(c) }}
        >
          {value === c && <Check size={compact ? 12 : 14} />}
        </button>
      ))}
    </div>
  );
}

// ---- Banner ----

export function BannerPopover({ card, anchor, onClose }: PopProps) {
  const [text, setText] = useState(card.bannerText);
  const [hex, setHex] = useState(card.bannerColor ?? '');
  const color = card.bannerColor;

  useEffect(() => setHex(card.bannerColor ?? ''), [card.bannerColor]);

  const setColor = (c: string) => void updateCard(card, { bannerColor: c }).catch(() => {});
  const saveText = () => {
    if (text.trim() !== card.bannerText) void updateCard(card, { bannerText: text.trim() }).catch(() => {});
  };

  return (
    <Popover anchor={anchor} onClose={() => { saveText(); onClose(); }} title="Banner">
      <div className="mb-3 overflow-hidden rounded-lg bg-card shadow-card">
        {color ? <Banner color={color} text={text.trim()} /> : <div className="flex h-6 items-center px-3 text-xs text-ink-subtle">No banner</div>}
        <div className="px-3 py-2 text-sm">{card.title}</div>
      </div>
      <p className="mb-1.5 text-xs font-semibold text-ink-subtle">Color</p>
      <Swatches colors={BANNER_SWATCHES} value={color} onPick={setColor} />
      <div className="mt-2 flex items-center gap-2">
        <input
          type="color"
          aria-label="Custom color"
          value={isHexColor(hex) ? hex : '#579dff'}
          onChange={(e) => setHex(e.target.value)}
          onBlur={() => isHexColor(hex) && hex !== color && setColor(hex)}
          className="h-9 w-12 shrink-0 cursor-pointer rounded border border-line bg-transparent p-0.5"
        />
        <input
          className={inputClass}
          value={hex}
          placeholder="#4bce97"
          maxLength={7}
          onChange={(e) => setHex(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && isHexColor(hex) && setColor(hex.toLowerCase())}
          onBlur={() => isHexColor(hex) && hex.toLowerCase() !== color && setColor(hex.toLowerCase())}
        />
      </div>
      <p className="mb-1 mt-3 text-xs font-semibold text-ink-subtle">Banner text</p>
      <input
        className={inputClass}
        value={text}
        maxLength={80}
        placeholder="e.g. Restock, Viral, Sample ordered"
        onChange={(e) => setText(e.target.value)}
        onBlur={saveText}
        onKeyDown={(e) => e.key === 'Enter' && saveText()}
      />
      {!color && text.trim() && <p className="mt-1 text-xs text-ink-subtle">Pick a color to show the banner.</p>}
      {color && (
        <Button
          className="mt-3 w-full"
          onClick={() => {
            setText('');
            void updateCard(card, { bannerColor: null, bannerText: '' }).catch(() => {});
          }}
        >
          Remove banner
        </Button>
      )}
    </Popover>
  );
}

// ---- Labels ----

export function LabelsPopover({ card, anchor, onClose }: PopProps) {
  const labels = useBoard((s) => s.labels);
  const [mode, setMode] = useState<{ kind: 'list' } | { kind: 'edit'; label: Label | null }>({ kind: 'list' });
  const [search, setSearch] = useState('');

  const list = Object.values(labels).filter((l) => l.name.toLowerCase().includes(search.trim().toLowerCase()));

  function toggle(id: number) {
    const has = card.labelIds.includes(id);
    void updateCard(card, { labelIds: has ? card.labelIds.filter((x) => x !== id) : [...card.labelIds, id] }).catch(() => {});
  }

  if (mode.kind === 'edit') {
    return (
      <Popover anchor={anchor} onClose={onClose} title={mode.label ? 'Edit label' : 'Create label'}>
        <LabelEditor
          boardId={card.boardId}
          label={mode.label}
          onDone={async (created) => {
            if (created) toggle(created.id);
            setMode({ kind: 'list' });
          }}
        />
      </Popover>
    );
  }

  return (
    <Popover anchor={anchor} onClose={onClose} title="Labels">
      <input className={inputClass} placeholder="Search labels…" value={search} onChange={(e) => setSearch(e.target.value)} />
      <p className="mb-1 mt-3 text-xs font-semibold text-ink-subtle">Labels</p>
      {list.length === 0 && <p className="py-2 text-sm text-ink-subtle">{Object.keys(labels).length ? 'No matching labels.' : 'This board has no labels yet.'}</p>}
      <div className="flex flex-col gap-1">
        {list.map((l) => (
          <div key={l.id} className="flex items-center gap-1">
            <button type="button" onClick={() => toggle(l.id)} className="flex min-h-9 flex-1 items-center gap-2 rounded px-1 hover:bg-hover">
              <span
                className={cx(
                  'flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border-2',
                  card.labelIds.includes(l.id) ? 'border-accent bg-accent text-accent-ink' : 'border-ink-subtle/60',
                )}
              >
                {card.labelIds.includes(l.id) && <Check size={12} strokeWidth={3} />}
              </span>
              <span
                className="flex h-8 flex-1 items-center truncate rounded px-3 text-sm font-semibold"
                style={{ background: colorFill(l.color), color: readableTextColor(l.color) }}
              >
                {l.name || ' '}
              </span>
            </button>
            <button
              type="button"
              aria-label={`Edit ${l.name}`}
              onClick={() => setMode({ kind: 'edit', label: l })}
              className="flex h-9 w-9 items-center justify-center rounded text-ink-subtle hover:bg-hover"
            >
              <Pencil size={14} />
            </button>
          </div>
        ))}
      </div>
      <Button className="mt-2 w-full" onClick={() => setMode({ kind: 'edit', label: null })}>
        Create a new label
      </Button>
    </Popover>
  );
}

/** Any solid color, or a left-to-right gradient between two colors. Changes apply to the preview immediately. */
function CustomLabelColor({ color, onChange }: { color: string; onChange: (c: string) => void }) {
  const g = parseGradientValue(color);
  const [mode, setMode] = useState<'solid' | 'gradient'>(g ? 'gradient' : 'solid');
  const [solid, setSolid] = useState(isHexColor(color) ? color : '#579dff');
  const [from, setFrom] = useState(g?.from ?? '#fc5c7d');
  const [to, setTo] = useState(g?.to ?? '#6a82fb');
  const lastEmitted = useRef(color);

  // A preset was picked above: start the custom controls from it so it can be fine-tuned.
  useEffect(() => {
    if (color === lastEmitted.current) return;
    lastEmitted.current = color;
    const pg = parseGradientValue(color);
    if (pg) {
      setMode('gradient');
      setFrom(pg.from);
      setTo(pg.to);
    } else if (isHexColor(color)) {
      setMode('solid');
      setSolid(color);
    }
  }, [color]);

  const emit = (next: { mode?: 'solid' | 'gradient'; solid?: string; from?: string; to?: string }) => {
    const m = next.mode ?? mode;
    const value = m === 'solid' ? (next.solid ?? solid) : gradientValue({ from: next.from ?? from, to: next.to ?? to, angle: 90 });
    lastEmitted.current = value;
    onChange(value);
  };

  const picker = (label: string, value: string, set: (v: string) => void, key: 'solid' | 'from' | 'to') => (
    <label className="flex flex-1 items-center gap-1.5 text-xs text-ink-subtle">
      <input
        type="color"
        aria-label={label}
        value={value}
        onChange={(e) => {
          set(e.target.value);
          emit({ [key]: e.target.value });
        }}
        className="h-8 w-10 shrink-0 cursor-pointer rounded border border-line bg-transparent p-0.5"
      />
      {label}
    </label>
  );

  return (
    <div className="mt-3">
      <div className="mb-2 flex items-center gap-2">
        <p className="flex-1 text-xs font-semibold text-ink-subtle">Custom</p>
        <div className="grid grid-cols-2 gap-0.5 rounded-md bg-sunken p-0.5">
          {(['solid', 'gradient'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                emit({ mode: m });
              }}
              className={cx('h-7 rounded px-2.5 text-xs font-semibold capitalize', mode === m ? 'bg-raised shadow-card' : 'text-ink-subtle hover:text-ink')}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        {mode === 'solid' ? (
          picker('Color', solid, setSolid, 'solid')
        ) : (
          <>
            {picker('Left', from, setFrom, 'from')}
            {picker('Right', to, setTo, 'to')}
          </>
        )}
      </div>
    </div>
  );
}

export function LabelEditor({
  boardId,
  label,
  onDone,
}: {
  boardId: number;
  label: Label | null;
  onDone: (created?: Label) => void;
}) {
  const [name, setName] = useState(label?.name ?? '');
  const [color, setColor] = useState(label?.color ?? LABEL_COLORS[0]);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      if (label) {
        await updateLabel(label, { name: name.trim(), color });
        onDone();
      } else {
        const res = await createLabel(boardId, name.trim(), color);
        onDone(res.labels?.[0]);
      }
    } catch {
      setBusy(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={() => onDone()} className="mb-2 flex items-center gap-1 text-xs text-ink-subtle hover:text-ink">
        <ChevronLeft size={14} /> Back
      </button>
      <div className="mb-3 flex h-14 items-center justify-center rounded bg-sunken px-4">
        <span className="flex h-8 max-w-full items-center truncate rounded px-3 text-sm font-semibold" style={{ background: colorFill(color), color: readableTextColor(color) }}>
          {name || ' '}
        </span>
      </div>
      <p className="mb-1 text-xs font-semibold text-ink-subtle">Title</p>
      <input className={inputClass} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} autoFocus onKeyDown={(e) => e.key === 'Enter' && void save()} />
      <p className="mb-1.5 mt-3 text-xs font-semibold text-ink-subtle">Colors</p>
      <Swatches colors={LABEL_COLORS} value={color} onPick={setColor} columns={10} compact />
      <p className="mb-1.5 mt-3 text-xs font-semibold text-ink-subtle">Gradients</p>
      <Swatches colors={LABEL_GRADIENTS} value={color} onPick={setColor} compact />
      <CustomLabelColor color={color} onChange={setColor} />
      <div className="mt-4 flex gap-2">
        <Button tone="primary" onClick={() => void save()} disabled={busy}>
          {label ? 'Save' : 'Create'}
        </Button>
        <div className="flex-1" />
        {label && (
          <Button
            tone="danger"
            onClick={async () => {
              const ok = await confirmDialog({
                title: `Delete label “${label.name || 'Unnamed'}”?`,
                message: 'It will be removed from every card on this board. This can’t be undone.',
                confirmLabel: 'Delete label',
                danger: true,
              });
              if (ok) {
                await deleteLabel(label).catch(() => {});
                onDone();
              }
            }}
          >
            Delete
          </Button>
        )}
      </div>
    </div>
  );
}

// ---- Day of week ----

export function DayPopover({ card, anchor, onClose, inDone }: PopProps & { inDone: boolean }) {
  const pick = (d: number | null) => {
    void updateCard(card, { dayOfWeek: d }).catch(() => {});
    onClose();
  };
  return (
    <Popover anchor={anchor} onClose={onClose} title="Day of week" width={260}>
      {inDone ? (
        <p className="py-2 text-sm text-ink-subtle">Cards in the Done list don’t have a day. Move the card out of Done to set one.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {DAYS.map((d, i) => (
            <button
              key={d}
              type="button"
              onClick={() => pick(i)}
              className={cx('flex min-h-10 items-center justify-between rounded px-3 text-sm sm:min-h-8', card.dayOfWeek === i ? 'bg-accent text-accent-ink' : 'hover:bg-hover')}
            >
              {d}
              {card.dayOfWeek === i && <Check size={14} />}
            </button>
          ))}
          <div className="my-1 border-t border-line" />
          <button type="button" onClick={() => pick(null)} className="min-h-10 rounded px-3 text-left text-sm hover:bg-hover sm:min-h-8">
            No day
          </button>
        </div>
      )}
    </Popover>
  );
}

// ---- Due date ----

export function DuePopover({ card, anchor, onClose }: PopProps) {
  const [value, setValue] = useState(toLocalInput(card.dueAt ?? defaultDue()));

  function defaultDue() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(17, 0, 0, 0);
    return d.getTime();
  }

  const save = (ms: number | null) => {
    void updateCard(card, { dueAt: ms }).catch(() => {});
    onClose();
  };

  const quick = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(17, 0, 0, 0);
    return d.getTime();
  };

  return (
    <Popover anchor={anchor} onClose={onClose} title="Due date" width={280}>
      <div className="mb-3 flex gap-1">
        {[
          ['Today', 0],
          ['Tomorrow', 1],
          ['In a week', 7],
        ].map(([label, days]) => (
          <Button key={label} className="flex-1 px-1 text-xs" onClick={() => setValue(toLocalInput(quick(days as number)))}>
            {label}
          </Button>
        ))}
      </div>
      <input type="datetime-local" className={inputClass + ' h-10'} value={value} onChange={(e) => setValue(e.target.value)} />
      <div className="mt-3 flex gap-2">
        <Button tone="primary" className="flex-1" disabled={!value} onClick={() => save(new Date(value).getTime())}>
          Save
        </Button>
        {card.dueAt != null && (
          <Button className="flex-1" onClick={() => save(null)}>
            Remove
          </Button>
        )}
      </div>
    </Popover>
  );
}
