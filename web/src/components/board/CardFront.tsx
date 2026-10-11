import { memo } from 'react';
import { CheckCircle2, Clock, MessageSquare, Play } from 'lucide-react';
import {
  DAY_SHORT,
  computeTotal,
  dueStatus,
  formatNumber,
  colorFill,
  readableTextColor,
  type Card,
  type Field,
  type Label,
} from '@triple-t/shared';
import { cx } from '../ui';
import { formatDue } from '../../lib/format';

export interface CardFrontData {
  card: Card;
  labels: Label[];
  frontFields: Field[];
  /** Raw values per video for each front field. */
  values: Record<number, string[]>;
  commentCount: number;
  videoCount: number;
  isToday: boolean;
  inDone: boolean;
}

export const LabelPill = ({ label, compact }: { label: Label; compact?: boolean }) => (
  <span
    className={cx(
      'inline-flex max-w-full items-center truncate rounded font-semibold',
      compact ? 'h-4 min-w-10 px-1.5 text-[11px] leading-4' : 'h-8 min-w-12 px-3 text-sm leading-8',
    )}
    style={{ background: colorFill(label.color), color: readableTextColor(label.color) }}
    title={label.name}
  >
    {label.name}
  </span>
);

export const Banner = ({ color, text, size = 'card' }: { color: string; text: string; size?: 'card' | 'modal' }) => (
  <div
    className={cx(
      'flex items-center overflow-hidden font-semibold',
      size === 'card' ? (text ? 'min-h-7 rounded-t-lg px-3 py-1 text-xs' : 'h-6 rounded-t-lg') : 'min-h-24 px-6 py-4 text-lg sm:rounded-t-xl',
    )}
    style={{ background: color, color: readableTextColor(color) }}
  >
    <span className={size === 'card' ? 'line-clamp-2 break-words' : 'break-words'}>{text}</span>
  </div>
);

function CardFrontImpl({ data, dragging }: { data: CardFrontData; dragging?: boolean }) {
  const { card, labels, frontFields, values, commentCount, videoCount, isToday, inDone } = data;
  const due = inDone ? null : dueStatus(card.dueAt);
  const totals = frontFields
    .map((f) => ({ field: f, total: computeTotal(f, values[f.id] ?? []) }))
    .filter((t) => t.total !== null);

  return (
    <div
      className={cx(
        'rounded-lg bg-card text-ink shadow-card',
        isToday && 'ring-2 ring-[#f5cd47]/60 dark:ring-[#cf9f02]/70',
        dragging && 'rotate-[3deg] shadow-pop',
      )}
    >
      {card.bannerColor && <Banner color={card.bannerColor} text={card.bannerText} />}
      <div className="px-3 pb-1.5 pt-1.5">
        {labels.length > 0 && (
          <div className="mb-1 flex flex-wrap gap-1">
            {labels.map((l) => (
              <LabelPill key={l.id} label={l} compact />
            ))}
          </div>
        )}
        <div className="break-words text-sm leading-5">{card.title}</div>
        <div className="mt-1 flex flex-wrap items-center gap-x-1 gap-y-1 text-xs text-ink-subtle empty:hidden">
          {card.dayOfWeek != null && (
            <span
              className={cx(
                'inline-flex h-6 items-center rounded px-1.5 font-semibold',
                isToday ? 'bg-[#f5cd47] text-[#533f04]' : 'bg-hover text-ink-subtle',
              )}
              title={isToday ? 'Today' : undefined}
            >
              {isToday ? `Today · ${DAY_SHORT[card.dayOfWeek]}` : DAY_SHORT[card.dayOfWeek]}
            </span>
          )}
          {card.dueAt != null && (
            <span
              className={cx(
                'inline-flex h-6 items-center gap-1 rounded px-1.5',
                inDone && 'bg-[#1f845a] text-white',
                due === 'overdue' && 'bg-[#c9372c] font-medium text-white',
                due === 'soon' && 'bg-[#f5cd47] font-medium text-[#533f04]',
              )}
              title={due === 'overdue' ? 'Overdue' : due === 'soon' ? 'Due within 24 hours' : 'Due date'}
            >
              {inDone ? <CheckCircle2 size={13} /> : <Clock size={13} />}
              {formatDue(card.dueAt, true)}
            </span>
          )}
          {commentCount > 0 && (
            <span className="inline-flex h-6 items-center gap-1 px-1" title={`${commentCount} comments`}>
              <MessageSquare size={13} />
              {commentCount}
            </span>
          )}
          {videoCount > 0 && (
            <span className="inline-flex h-6 items-center gap-1 px-1" title={`${videoCount} videos`}>
              <Play size={13} />
              {videoCount}
            </span>
          )}
          {totals.map(({ field, total }) => (
            <span
              key={field.id}
              className="inline-flex h-6 items-center gap-1 rounded bg-hover px-1.5"
              title={`${field.name} (${field.totalMode === 'avg' ? 'average' : 'total'})`}
            >
              <span className="font-semibold text-ink">{formatNumber(field.type, total!, { compact: true })}</span>
              <span>{field.name}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export const CardFront = memo(CardFrontImpl);
