import { useEffect, useRef, useState } from 'react';
import { Bookmark, Check, ChevronLeft, ChevronRight, Pencil, X } from 'lucide-react';
import {
  BANNER_SWATCHES,
  DAYS,
  LABEL_COLORS,
  LABEL_GRADIENTS,
  addDays,
  endOfDayInTz,
  sameYmd,
  ymdInTz,
  type YMD,
  gradientValue,
  isHexColor,
  parseGradientValue,
  colorFill,
  readableTextColor,
  type Card,
  type Label,
} from '@triple-t/shared';
import { createLabel, deleteBannerPreset, deleteLabel, saveBannerPreset, updateCard, updateLabel } from '../../lib/actions';
import { useBoard } from '../../stores/board';
import { useSession } from '../../stores/session';
import { Button, IconButton, Popover, confirmDialog, cx, inputClass } from '../ui';
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
  const presetMap = useBoard((s) => s.bannerPresets);
  const presets = Object.values(presetMap).sort((a, b) => a.text.localeCompare(b.text));
  const color = card.bannerColor;
  const saved = color ? presets.find((p) => p.color === color) : undefined;

  useEffect(() => setHex(card.bannerColor ?? ''), [card.bannerColor]);

  /** Picking a color that has saved text fills the text in too. */
  const setColor = (c: string) => {
    const preset = presets.find((p) => p.color === c.toLowerCase());
    if (preset) {
      setText(preset.text);
      void updateCard(card, { bannerColor: c, bannerText: preset.text }).catch(() => {});
    } else {
      void updateCard(card, { bannerColor: c }).catch(() => {});
    }
  };
  const saveText = () => {
    if (text.trim() !== card.bannerText) void updateCard(card, { bannerText: text.trim() }).catch(() => {});
  };

  return (
    <Popover anchor={anchor} onClose={() => { saveText(); onClose(); }} title="Banner">
      <div className="mb-3 overflow-hidden rounded-lg bg-card shadow-card">
        {color ? <Banner color={color} text={text.trim()} /> : <div className="flex h-6 items-center px-3 text-xs text-ink-subtle">No banner</div>}
        <div className="px-3 py-2 text-sm">{card.title}</div>
      </div>

      {presets.length > 0 && (
        <>
          <p className="mb-1.5 text-xs font-semibold text-ink-subtle">Saved banners</p>
          <div className="mb-3 flex flex-col gap-1">
            {presets.map((p) => (
              <div key={p.id} className="group flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setColor(p.color)}
                  className={cx(
                    'flex h-8 min-w-0 flex-1 items-center truncate rounded px-2.5 text-left text-xs font-semibold',
                    color === p.color && card.bannerText === p.text && 'ring-2 ring-accent ring-offset-1 ring-offset-raised',
                  )}
                  style={{ background: p.color, color: readableTextColor(p.color) }}
                >
                  {p.text}
                </button>
                <IconButton
                  label={`Forget saved banner “${p.text}”`}
                  className="h-8 w-8 opacity-60 group-hover:opacity-100"
                  onClick={() => void deleteBannerPreset(p).catch(() => {})}
                >
                  <X size={14} />
                </IconButton>
              </div>
            ))}
          </div>
        </>
      )}

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
      {color && text.trim() && (
        saved && saved.text === text.trim() ? (
          <p className="mt-1.5 flex items-center gap-1 text-xs text-ink-subtle">
            <Check size={13} className="text-[#1f845a] dark:text-[#4bce97]" /> Saved for this color: picking it fills this text in.
          </p>
        ) : (
          <Button
            className="mt-2 w-full"
            onClick={() => {
              saveText();
              void saveBannerPreset(card.boardId, color, text.trim()).catch(() => {});
            }}
          >
            <Bookmark size={14} /> {saved ? `Replace saved text “${saved.text}” for this color` : 'Save this text for this color'}
          </Button>
        )
      )}
      {color && (
        <Button
          className="mt-2 w-full"
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

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/**
 * Date-only due date picker. Clicking a day (or a shortcut) saves and closes
 * straight away; the card is due through the end of that day in the board's time zone.
 */
export function DuePopover({ card, anchor, onClose }: PopProps) {
  const tz = useSession((s) => s.tz);
  const today = ymdInTz(Date.now(), tz);
  const selected = card.dueAt != null ? ymdInTz(card.dueAt, tz) : null;
  const [view, setView] = useState(() => ({ y: (selected ?? today).y, m: (selected ?? today).m }));

  const pick = (day: YMD | null) => {
    void updateCard(card, { dueAt: day ? endOfDayInTz(day, tz) : null }).catch(() => {});
    onClose();
  };

  // Six weeks starting on the Sunday on or before the 1st of the month.
  const firstWeekday = new Date(Date.UTC(view.y, view.m - 1, 1)).getUTCDay();
  const start = addDays({ y: view.y, m: view.m, d: 1 }, -firstWeekday);
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const monthLabel = new Date(Date.UTC(view.y, view.m - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const shift = (delta: number) => {
    const d = addDays({ y: view.y, m: view.m, d: 1 }, delta > 0 ? 32 : -1);
    setView({ y: d.y, m: d.m });
  };

  return (
    <Popover anchor={anchor} onClose={onClose} title="Due date" width={288}>
      <div className="mb-3 grid grid-cols-3 gap-1">
        {(
          [
            ['Today', 0],
            ['Tomorrow', 1],
            ['Next week', 7],
          ] as const
        ).map(([label, n]) => (
          <Button key={label} className="px-1 text-xs" onClick={() => pick(addDays(today, n))}>
            {label}
          </Button>
        ))}
      </div>

      <div className="mb-1 flex items-center justify-between">
        <IconButton label="Previous month" onClick={() => shift(-1)}>
          <ChevronLeft size={16} />
        </IconButton>
        <span className="text-sm font-semibold">{monthLabel}</span>
        <IconButton label="Next month" onClick={() => shift(1)}>
          <ChevronRight size={16} />
        </IconButton>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-ink-subtle">
        {WEEKDAYS.map((w, i) => (
          <span key={i} className="py-1">
            {w}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5" role="grid" aria-label={monthLabel}>
        {days.map((day) => {
          const inMonth = day.m === view.m;
          const isSelected = sameYmd(day, selected);
          const isToday = sameYmd(day, today);
          return (
            <button
              key={`${day.y}-${day.m}-${day.d}`}
              type="button"
              onClick={() => pick(day)}
              aria-label={new Date(Date.UTC(day.y, day.m - 1, day.d)).toLocaleDateString('en-US', { dateStyle: 'full', timeZone: 'UTC' })}
              aria-pressed={isSelected}
              className={cx(
                'flex h-9 items-center justify-center rounded text-sm sm:h-8',
                isSelected ? 'bg-accent font-semibold text-accent-ink' : 'hover:bg-hover',
                !isSelected && !inMonth && 'text-ink-subtle/50',
                !isSelected && isToday && 'font-bold text-accent ring-1 ring-inset ring-accent',
              )}
            >
              {day.d}
            </button>
          );
        })}
      </div>

      {card.dueAt != null && (
        <Button className="mt-3 w-full" onClick={() => pick(null)}>
          Remove due date
        </Button>
      )}
    </Popover>
  );
}
