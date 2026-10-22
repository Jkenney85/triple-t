import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ExternalLink, Loader2, Play, Receipt, RefreshCw, Sigma, Trash2, Video as VideoIcon } from 'lucide-react';
import {
  computeTotal,
  formatMonth,
  formatNumber,
  isNumericType,
  isTikTokUrl,
  monthInTz,
  monthsWithData,
  parseNumeric,
  shiftMonth,
  videoFieldValues,
  type Card,
  type Comment,
  type Field,
  type Video,
} from '@triple-t/shared';
import { addManualSales, addVideo, deleteVideo, refreshVideo, renameManualSales, setVideoValue } from '../../lib/actions';
import { useDraft } from '../../lib/useDraft';
import { useBoard } from '../../stores/board';
import { useSession } from '../../stores/session';
import PeriodPicker from './PeriodPicker';
import { VideoComments } from './CommentsSection';
import { Button, IconButton, confirmDialog, cx, inputClass } from '../ui';

export default function VideosSection({
  card,
  videos,
  fields,
  comments,
  inputId,
}: {
  card: Card;
  videos: Video[];
  fields: Field[];
  comments: Comment[];
  inputId: string;
}) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const valid = isTikTokUrl(url.trim());
  const linkedCount = videos.filter((v) => v.kind === 'tiktok').length;
  const hasManual = videos.length > linkedCount;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    try {
      await addVideo(card, url.trim());
      setUrl('');
    } catch {
      // toast shown
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <VideoIcon size={18} className="text-ink-subtle" />
        <h3 className="flex-1 text-base font-semibold">
          Videos {linkedCount > 0 && <span className="font-normal text-ink-subtle">({linkedCount})</span>}
        </h3>
      </div>

      {videos.length > 0 && <Totals videos={videos} fields={fields} label={hasManual ? 'Totals across videos and other sales for' : 'Totals across videos for'} />}

      <div className="flex flex-col gap-3">
        {videos.map((v) => (
          <VideoRow key={v.id} video={v} fields={fields} boardId={card.boardId} comments={comments.filter((c) => c.videoId === v.id)} />
        ))}
      </div>

      <form onSubmit={add} className="mt-3 flex gap-2">
        <input
          id={inputId}
          className={inputClass + ' h-10 text-base sm:h-9 sm:text-sm'}
          placeholder="Paste a TikTok link (tiktok.com or vm.tiktok.com)"
          value={url}
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          onChange={(e) => setUrl(e.target.value)}
        />
        <Button tone="primary" type="submit" disabled={!valid || busy} className="h-10 shrink-0 sm:h-9">
          Add video
        </Button>
      </form>
      {url.trim() && !valid && <p className="mt-1 text-xs text-danger">That doesn’t look like a TikTok link.</p>}
      <button
        type="button"
        onClick={() => void addManualSales(card).catch(() => {})}
        className="mt-2 flex items-center gap-1.5 rounded px-1 py-1 text-xs font-semibold text-ink-subtle hover:text-ink"
      >
        <Receipt size={14} /> Add sales without a video
      </button>
    </section>
  );
}

function Totals({ videos, fields, label }: { videos: Video[]; fields: Field[]; label: string }) {
  const period = useBoard((s) => s.period);
  const totals = useMemo(
    () =>
      fields
        .filter((f) => isNumericType(f.type) && f.totalMode !== 'none')
        .map((f) => ({ field: f, total: computeTotal(f, videos.flatMap((v) => videoFieldValues(v, f.id, period))) })),
    [fields, videos, period],
  );
  if (totals.length === 0) return null;
  return (
    <div className="mb-3">
      <div className="mb-1.5 flex items-center gap-2 text-xs text-ink-subtle">
        <span className="font-semibold">{label}</span>
        <PeriodPicker variant="inline" />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {totals.map(({ field, total }) => (
          <div key={field.id} className="rounded-lg bg-sunken px-3 py-2">
            <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">
              <Sigma size={11} /> {field.name} {field.totalMode === 'avg' ? 'avg' : 'total'}
            </div>
            <div className="text-lg font-semibold">{total === null ? '—' : formatNumber(field.type, total)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function VideoRow({ video, fields, boardId, comments }: { video: Video; fields: Field[]; boardId: number; comments: Comment[] }) {
  const [imgFailed, setImgFailed] = useState(false);
  const live = useBoard((s) => s.videos[video.id]) ?? video;
  const showThumb = live.thumbnail && !imgFailed;

  if (live.kind === 'manual') {
    return (
      <div className="rounded-lg border border-dashed border-line bg-card p-2.5">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-sunken text-ink-subtle">
            <Receipt size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <ManualSalesName video={live} boardId={boardId} />
            <p className="px-1.5 text-xs text-ink-subtle">Sales not tied to a linked video; counted in the card’s totals.</p>
          </div>
          <IconButton
            label="Remove this sales entry"
            onClick={async () => {
              if (await confirmDialog({ title: `Remove “${live.title}”?`, message: 'Its monthly numbers are removed too.', confirmLabel: 'Remove', danger: true })) {
                void deleteVideo(boardId, live).catch(() => {});
              }
            }}
          >
            <Trash2 size={14} />
          </IconButton>
        </div>
        {fields.length > 0 && <VideoMetrics video={live} fields={fields} boardId={boardId} />}
        <VideoComments video={live} comments={comments} boardId={boardId} />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-line bg-card p-2.5">
      <div className="flex gap-3">
        <a
          href={live.url}
          target="_blank"
          rel="noopener noreferrer"
          className="relative flex h-32 w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-md bg-sunken"
          aria-label="Open video on TikTok"
        >
          {showThumb ? (
            <img src={live.thumbnail!} alt="" className="h-full w-full object-cover" loading="lazy" onError={() => setImgFailed(true)} />
          ) : (
            <Play size={24} className="text-ink-subtle" />
          )}
          {live.status === 'pending' && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/40">
              <Loader2 size={20} className="animate-spin text-white" />
            </span>
          )}
        </a>
        <div className="min-w-0 flex-1">
          <a href={live.url} target="_blank" rel="noopener noreferrer" className="line-clamp-2 text-sm font-medium hover:underline">
            {live.title || (live.status === 'pending' ? 'Fetching video details…' : 'TikTok video')}
          </a>
          {live.author && <div className="truncate text-xs text-ink-subtle">@{live.author.replace(/^@/, '')}</div>}
          <a
            href={live.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-0.5 flex items-center gap-1 truncate text-xs text-accent hover:underline"
          >
            <ExternalLink size={12} className="shrink-0" />
            <span className="truncate">{live.url.replace(/^https?:\/\/(www\.)?/, '')}</span>
          </a>
          {live.status === 'error' && (
            <p className="mt-1 text-xs text-ink-subtle" title={live.error ?? undefined}>
              Couldn’t fetch the thumbnail — the link still works.
            </p>
          )}
          <div className="mt-1 flex gap-1">
            <IconButton label="Refresh thumbnail" disabled={live.status === 'pending'} onClick={() => void refreshVideo(boardId, live).catch(() => {})}>
              <RefreshCw size={14} className={cx(live.status === 'pending' && 'animate-spin')} />
            </IconButton>
            <IconButton
              label="Remove video"
              onClick={async () => {
                if (await confirmDialog({ title: 'Remove this video?', message: 'Its metric values are removed too.', confirmLabel: 'Remove', danger: true })) {
                  void deleteVideo(boardId, live).catch(() => {});
                }
              }}
            >
              <Trash2 size={14} />
            </IconButton>
          </div>
        </div>
      </div>
      {fields.length > 0 && <VideoMetrics video={live} fields={fields} boardId={boardId} />}
      <VideoComments video={live} comments={comments} boardId={boardId} />
    </div>
  );
}

function ManualSalesName({ video, boardId }: { video: Video; boardId: number }) {
  const { draft, setDraft, setEditing } = useDraft(video.title);
  function save() {
    setEditing(false);
    const t = draft.trim();
    if (!t) return setDraft(video.title);
    if (t !== video.title) void renameManualSales(boardId, video, t).catch(() => {});
  }
  return (
    <input
      aria-label="Name of this sales entry"
      value={draft}
      maxLength={200}
      onFocus={() => setEditing(true)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      className="w-full rounded border-2 border-transparent bg-transparent px-1.5 py-0.5 text-sm font-semibold text-ink outline-none hover:bg-hover focus:border-accent focus:bg-card"
    />
  );
}

/**
 * Per-month metrics for one video. TikTok reports numbers by period, so each
 * month is entered separately; the all-time line and history roll them up.
 */
function VideoMetrics({ video, fields, boardId }: { video: Video; fields: Field[]; boardId: number }) {
  const period = useBoard((s) => s.period);
  const tz = useSession((s) => s.tz);
  const current = monthInTz(new Date(), tz);
  const [month, setMonth] = useState(period !== 'all' ? period : current);
  const [showHistory, setShowHistory] = useState(false);

  // Picking a month for the whole board jumps every video to it.
  useEffect(() => {
    if (period !== 'all') setMonth(period);
  }, [period]);

  const history = monthsWithData([video]);
  const totalFields = fields.filter((f) => isNumericType(f.type) && f.totalMode !== 'none');
  const allTime = totalFields
    .map((f) => ({ field: f, total: computeTotal(f, videoFieldValues(video, f.id, 'all')) }))
    .filter((t) => t.total !== null);

  return (
    <div className="mt-2.5">
      <div className="mb-1.5 flex items-center gap-1">
        <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Metrics for</span>
        <IconButton label="Previous month" className="h-7 w-7" onClick={() => setMonth(shiftMonth(month, -1))}>
          <ChevronLeft size={15} />
        </IconButton>
        <span className="min-w-[72px] text-center text-sm font-semibold">{formatMonth(month)}</span>
        <IconButton
          label="Next month"
          className="h-7 w-7 disabled:opacity-30"
          disabled={month >= current}
          onClick={() => setMonth(shiftMonth(month, 1))}
        >
          <ChevronRight size={15} />
        </IconButton>
        {month !== current && (
          <button type="button" className="ml-1 text-xs text-accent hover:underline" onClick={() => setMonth(current)}>
            This month
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {fields.map((f) => (
          <MetricInput key={`${f.id}-${month}`} field={f} video={video} month={month} boardId={boardId} />
        ))}
      </div>

      {history.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-subtle">
          {allTime.length > 0 && (
            <span>
              <span className="font-semibold">All time:</span>{' '}
              {allTime.map(({ field, total }, i) => (
                <span key={field.id}>
                  {i > 0 && ' · '}
                  <span className="font-semibold text-ink">{formatNumber(field.type, total!, { compact: true })}</span> {field.name}
                </span>
              ))}
            </span>
          )}
          <button
            type="button"
            aria-expanded={showHistory}
            onClick={() => setShowHistory((v) => !v)}
            className="flex items-center gap-1 font-semibold hover:text-ink"
          >
            History ({history.length} {history.length === 1 ? 'month' : 'months'})
            <ChevronDown size={13} className={cx('transition-transform', showHistory && 'rotate-180')} />
          </button>
        </div>
      )}

      {showHistory && history.length > 0 && (
        <div className="mt-2 overflow-x-auto rounded-md border border-line">
          <table className="w-full text-xs">
            <thead className="bg-sunken text-left text-ink-subtle">
              <tr>
                <th className="px-2 py-1.5 font-semibold">Month</th>
                {fields.map((f) => (
                  <th key={f.id} className="px-2 py-1.5 text-right font-semibold">
                    {f.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map((m) => (
                <tr
                  key={m}
                  onClick={() => setMonth(m)}
                  className={cx('cursor-pointer border-t border-line hover:bg-hover', m === month && 'bg-accent/10')}
                  title="Edit this month"
                >
                  <td className="px-2 py-1.5 font-medium">{formatMonth(m)}</td>
                  {fields.map((f) => {
                    const raw = video.months[m]?.[f.id];
                    const n = isNumericType(f.type) ? parseNumeric(raw) : null;
                    return (
                      <td key={f.id} className="px-2 py-1.5 text-right tabular-nums">
                        {raw == null ? '—' : n !== null ? formatNumber(f.type, n) : raw}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function MetricInput({ field, video, month, boardId }: { field: Field; video: Video; month: string; boardId: number }) {
  const remote = video.months[month]?.[field.id] ?? '';
  const { draft, setDraft, setEditing } = useDraft(remote);
  const numeric = isNumericType(field.type);

  function save() {
    setEditing(false);
    if (draft.trim() !== remote) void setVideoValue(boardId, video, month, field.id, draft.trim()).catch(() => {});
  }

  return (
    <label className="block min-w-0">
      <span className="mb-0.5 block truncate text-[11px] font-semibold text-ink-subtle">{field.name}</span>
      <span className="relative block">
        {field.type === 'currency' && <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-sm text-ink-subtle">$</span>}
        <input
          className={cx(inputClass, 'h-9 text-base sm:h-8 sm:text-sm', field.type === 'currency' && 'pl-5', field.type === 'percent' && 'pr-6')}
          type={field.type === 'date' ? 'date' : field.type === 'url' ? 'url' : 'text'}
          inputMode={numeric ? 'decimal' : field.type === 'url' ? 'url' : undefined}
          value={draft}
          onFocus={() => setEditing(true)}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          placeholder={numeric ? '0' : ''}
          aria-label={`${field.name} for ${formatMonth(month, 'long')}`}
        />
        {field.type === 'percent' && <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-sm text-ink-subtle">%</span>}
      </span>
    </label>
  );
}
