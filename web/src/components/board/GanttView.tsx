import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, TriangleAlert } from 'lucide-react';
import {
  DAY_SHORT,
  addDays,
  colorFill,
  dayNumber,
  dueStatus,
  ganttSpan,
  readableTextColor,
  ymdInTz,
  type Card,
  type Column,
  type GanttSpan,
  type Label,
  type YMD,
} from '@triple-t/shared';
import { useSession } from '../../stores/session';
import { cx } from '../ui';

/** day = 0 means the days stretch to fill the width (the 1-week view). */
const ZOOMS = [
  { weeks: 1, day: 0, label: '1 week' },
  { weeks: 2, day: 56, label: '2 weeks' },
  { weeks: 4, day: 36, label: '4 weeks' },
  { weeks: 8, day: 22, label: '8 weeks' },
] as const;

interface Row {
  card: Card;
  span: GanttSpan;
  labels: Label[];
}

const fmt = (d: YMD, opts: Intl.DateTimeFormatOptions) =>
  new Date(Date.UTC(d.y, d.m - 1, d.d)).toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' });

/** Bar color: the card's banner, else its first label, else the accent. */
function barFill(row: Row): { background: string; color: string } {
  if (row.card.bannerColor) return { background: row.card.bannerColor, color: readableTextColor(row.card.bannerColor) };
  const label = row.labels[0];
  if (label) return { background: colorFill(label.color), color: readableTextColor(label.color) };
  return { background: 'var(--accent)', color: 'var(--accent-ink)' };
}

/**
 * Gantt chart of cards that have a day of week and/or a due date, grouped by
 * list in board order. Uses the same filtered cards as the board view.
 */
export default function GanttView({
  columns,
  cardIdsByColumn,
  cards,
  labelsById,
  onOpenCard,
}: {
  columns: Column[];
  cardIdsByColumn: Record<number, number[]>;
  cards: Record<number, Card>;
  labelsById: Record<number, Label>;
  onOpenCard: (id: number) => void;
}) {
  const tz = useSession((s) => s.tz);
  const today = ymdInTz(Date.now(), tz);
  // The chart starts at yesterday, and day-of-week plans roll forward from there.
  const yesterday = addDays(today, -1);
  const [offsetWeeks, setOffsetWeeks] = useState(0);
  const [zoom, setZoom] = useState<(typeof ZOOMS)[number]>(ZOOMS[0]);
  const fluid = zoom.day === 0;

  const start = addDays(yesterday, offsetWeeks * 7);
  const dayCount = zoom.weeks * 7;
  const days = useMemo(() => Array.from({ length: dayCount }, (_, i) => addDays(start, i)), [start.y, start.m, start.d, dayCount]);
  const startN = dayNumber(start);
  const todayN = dayNumber(today);

  const { groups, hidden } = useMemo(() => {
    let hiddenCount = 0;
    const out: { column: Column; rows: Row[] }[] = [];
    for (const column of columns) {
      const rows: Row[] = [];
      for (const id of cardIdsByColumn[column.id] ?? []) {
        const card = cards[id];
        if (!card) continue;
        const span = ganttSpan(card, yesterday, tz);
        if (!span) {
          hiddenCount++;
          continue;
        }
        rows.push({ card, span, labels: card.labelIds.map((l) => labelsById[l]).filter(Boolean) });
      }
      // Rows keep the list's own order (its sort setting), so the chart matches the board.
      if (rows.length) out.push({ column, rows });
    }
    return { groups: out, hidden: hiddenCount };
  }, [columns, cardIdsByColumn, cards, labelsById, yesterday.y, yesterday.m, yesterday.d, tz]);

  const labelWidth = 'var(--gantt-label)';
  const gridTemplate = fluid ? `${labelWidth} repeat(${dayCount}, minmax(64px, 1fr))` : `${labelWidth} repeat(${dayCount}, ${zoom.day}px)`;
  const total = groups.reduce((n, g) => n + g.rows.length, 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col px-[max(0.75rem,env(safe-area-inset-left))] pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1 [--gantt-label:140px] sm:[--gantt-label:220px]">
      {/* Toolbar */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5 text-white">
        <button
          type="button"
          aria-label="Earlier"
          onClick={() => setOffsetWeeks((w) => w - 1)}
          className="flex h-9 w-9 items-center justify-center rounded bg-black/30 backdrop-blur-sm hover:bg-black/45"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          type="button"
          onClick={() => setOffsetWeeks(0)}
          className="h-9 rounded bg-black/30 px-3 text-sm font-medium backdrop-blur-sm hover:bg-black/45"
        >
          Today
        </button>
        <button
          type="button"
          aria-label="Later"
          onClick={() => setOffsetWeeks((w) => w + 1)}
          className="flex h-9 w-9 items-center justify-center rounded bg-black/30 backdrop-blur-sm hover:bg-black/45"
        >
          <ChevronRight size={18} />
        </button>
        <span className="ml-1 rounded bg-black/30 px-2.5 py-1.5 text-sm font-semibold backdrop-blur-sm">
          {fmt(days[0], { month: 'short', day: 'numeric' })} – {fmt(days[days.length - 1], { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
        <div className="flex-1" />
        <div className="flex rounded bg-black/30 p-0.5 backdrop-blur-sm" role="radiogroup" aria-label="Zoom">
          {ZOOMS.map((z) => (
            <button
              key={z.weeks}
              type="button"
              role="radio"
              aria-checked={zoom.weeks === z.weeks}
              onClick={() => setZoom(z)}
              className={cx('h-8 rounded px-2.5 text-xs font-semibold', zoom.weeks === z.weeks ? 'bg-white text-[#172b4d]' : 'hover:bg-white/15')}
            >
              {z.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-xl bg-list text-ink shadow-card">
        {total === 0 ? (
          <div className="flex h-full min-h-48 flex-col items-center justify-center gap-1 p-6 text-center">
            <CalendarDays size={28} className="text-ink-subtle" />
            <p className="font-semibold">Nothing to chart yet</p>
            <p className="max-w-sm text-sm text-ink-subtle">Cards show up here once they have a day of week or a due date.</p>
          </div>
        ) : (
          <div className={cx('relative min-w-full', fluid ? 'w-full' : 'w-max')}>
            {/* Header */}
            <div className="sticky top-0 z-20 grid border-b border-line bg-list" style={{ gridTemplateColumns: gridTemplate }}>
              <div className="sticky left-0 z-10 flex items-end bg-list px-3 pb-1.5 text-xs font-semibold text-ink-subtle">Card</div>
              {days.map((d, i) => {
                const n = dayNumber(d);
                const weekday = new Date(Date.UTC(d.y, d.m - 1, d.d)).getUTCDay();
                const firstOfMonth = d.d === 1 || i === 0;
                return (
                  <div
                    key={n}
                    className={cx(
                      'flex flex-col items-center justify-end pb-1 pt-1 text-[11px] leading-tight',
                      weekday === 0 && 'border-l border-line',
                      n === todayN ? 'font-bold text-accent' : 'text-ink-subtle',
                    )}
                  >
                    <span className="h-3.5 truncate px-0.5 text-[10px] font-semibold uppercase">{firstOfMonth ? fmt(d, { month: 'short' }) : ''}</span>
                    {(fluid || zoom.day >= 30) && <span>{DAY_SHORT[weekday].slice(0, fluid || zoom.day >= 50 ? 3 : 1)}</span>}
                    <span className={cx(n === todayN && 'rounded-full bg-accent px-1 text-accent-ink')}>{d.d}</span>
                  </div>
                );
              })}
            </div>

            {/* Weekend shading and the today line, behind the rows */}
            <div className="pointer-events-none absolute inset-0 grid" style={{ gridTemplateColumns: gridTemplate }} aria-hidden>
              <div />
              {days.map((d) => {
                const n = dayNumber(d);
                const weekday = new Date(Date.UTC(d.y, d.m - 1, d.d)).getUTCDay();
                return (
                  <div
                    key={n}
                    className={cx(
                      'relative',
                      (weekday === 0 || weekday === 6) && 'bg-hover',
                      weekday === 0 && 'border-l border-line',
                    )}
                  >
                    {n === todayN && <div className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-accent/70" />}
                  </div>
                );
              })}
            </div>

            {/* Rows grouped by list */}
            {groups.map(({ column, rows }) => (
              <div key={column.id} className="relative">
                <div className="sticky left-0 z-10 flex w-max items-center gap-2 px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                  <span className="h-2.5 w-2.5 rounded-full border border-line" style={{ background: column.color ?? 'transparent' }} />
                  {column.name}
                  <span className="font-normal normal-case tracking-normal">· {rows.length}</span>
                </div>
                {rows.map((row) => (
                  <GanttRow
                    key={row.card.id}
                    row={row}
                    column={column}
                    gridTemplate={gridTemplate}
                    startN={startN}
                    dayCount={dayCount}
                    dayWidth={zoom.day}
                    onOpen={() => onOpenCard(row.card.id)}
                  />
                ))}
              </div>
            ))}
            <div className="h-3" />
          </div>
        )}
      </div>
      {hidden > 0 && total > 0 && (
        <p className="mt-1.5 text-xs text-white/85 drop-shadow">
          {hidden} card{hidden === 1 ? '' : 's'} without a day or due date {hidden === 1 ? "isn't" : "aren't"} shown.
        </p>
      )}
    </div>
  );
}

function GanttRow({
  row,
  column,
  gridTemplate,
  startN,
  dayCount,
  dayWidth,
  onOpen,
}: {
  row: Row;
  column: Column;
  gridTemplate: string;
  startN: number;
  dayCount: number;
  dayWidth: number;
  onOpen: () => void;
}) {
  const { card, span } = row;
  const from = dayNumber(span.start) - startN;
  const to = dayNumber(span.end) - startN;
  const visible = to >= 0 && from < dayCount;
  const clippedLeft = from < 0;
  const clippedRight = to >= dayCount;
  const colStart = Math.max(from, 0) + 2;
  const colEnd = Math.min(to, dayCount - 1) + 3;
  const fill = barFill(row);
  const status = column.isDone ? 'done' : dueStatus(card.dueAt);
  const tip = [
    card.title,
    span.planned ? `Planned ${fmt(span.planned, { weekday: 'short', month: 'short', day: 'numeric' })}` : null,
    span.due ? `Due ${fmt(span.due, { weekday: 'short', month: 'short', day: 'numeric' })}` : null,
    span.late ? 'Planned after its due date' : null,
    `List: ${column.name}`,
  ]
    .filter(Boolean)
    .join('\n');

  const barWidth = (Math.min(to, dayCount - 1) - Math.max(from, 0) + 1) * (dayWidth || 110);
  const showTitle = barWidth >= 90;

  return (
    <div className="relative grid min-h-9 items-center hover:bg-hover/60" style={{ gridTemplateColumns: gridTemplate }}>
      <button
        type="button"
        onClick={onOpen}
        className="sticky left-0 z-10 flex h-full min-w-0 items-center gap-1.5 bg-list px-3 text-left text-sm hover:underline"
        title={tip}
      >
        {card.bannerColor && <span className="h-3 w-1 shrink-0 rounded-full" style={{ background: card.bannerColor }} />}
        <span className={cx('truncate', column.isDone && 'text-ink-subtle line-through decoration-ink-subtle/50')}>{card.title}</span>
      </button>
      {visible ? (
        <button
          type="button"
          onClick={onOpen}
          title={tip}
          style={{ gridColumn: `${colStart} / ${colEnd}`, background: fill.background, color: fill.color }}
          className={cx(
            'relative z-[1] mx-0.5 flex h-7 min-w-0 items-center gap-1 overflow-hidden px-1.5 text-xs font-semibold shadow-card transition-[filter] hover:brightness-110',
            clippedLeft ? 'rounded-r-md' : 'rounded-l-md',
            clippedRight ? 'rounded-l-md' : 'rounded-r-md',
            clippedLeft && clippedRight && 'rounded-none',
            column.isDone && 'opacity-55',
            status === 'overdue' && 'ring-2 ring-[#c9372c]',
            span.late && 'outline-2 outline-dashed outline-[#c9372c] outline-offset-1',
          )}
        >
          {span.planned && !span.due && <CalendarDays size={12} className="shrink-0" />}
          {span.due && !span.planned && <Clock size={12} className="shrink-0" />}
          {span.late && <TriangleAlert size={12} className="shrink-0" />}
          {showTitle && <span className="truncate">{card.title}</span>}
          {span.due && span.planned && !span.late && dayNumber(span.end) - startN < dayCount && (
            <Clock size={12} className="ml-auto shrink-0 opacity-80" aria-label="Due" />
          )}
        </button>
      ) : (
        <span
          className="px-2 text-[11px] text-ink-subtle"
          style={{ gridColumn: from < 0 ? '2 / span 6' : `${dayCount - 4} / span 5`, justifySelf: from < 0 ? 'start' : 'end' }}
        >
          {from < 0 ? `← ${fmt(span.end, { month: 'short', day: 'numeric' })}` : `${fmt(span.start, { month: 'short', day: 'numeric' })} →`}
        </span>
      )}
    </div>
  );
}
