import { useMemo, useState } from 'react';
import { ExternalLink, Loader2, Play, RefreshCw, Sigma, Trash2, Video as VideoIcon } from 'lucide-react';
import {
  computeTotal,
  formatNumber,
  isNumericType,
  isTikTokUrl,
  type Card,
  type Field,
  type Video,
} from '@triple-t/shared';
import { addVideo, deleteVideo, refreshVideo, setVideoValue } from '../../lib/actions';
import { useDraft } from '../../lib/useDraft';
import { useBoard } from '../../stores/board';
import { Button, IconButton, confirmDialog, cx, inputClass } from '../ui';

export default function VideosSection({ card, videos, fields, inputId }: { card: Card; videos: Video[]; fields: Field[]; inputId: string }) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const valid = isTikTokUrl(url.trim());

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
          Videos {videos.length > 0 && <span className="font-normal text-ink-subtle">({videos.length})</span>}
        </h3>
      </div>

      {videos.length > 0 && <Totals videos={videos} fields={fields} />}

      <div className="flex flex-col gap-3">
        {videos.map((v) => (
          <VideoRow key={v.id} video={v} fields={fields} boardId={card.boardId} />
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
    </section>
  );
}

function Totals({ videos, fields }: { videos: Video[]; fields: Field[] }) {
  const totals = useMemo(
    () =>
      fields
        .filter((f) => isNumericType(f.type) && f.totalMode !== 'none')
        .map((f) => ({ field: f, total: computeTotal(f, videos.map((v) => v.values[f.id])) })),
    [fields, videos],
  );
  if (totals.length === 0) return null;
  return (
    <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {totals.map(({ field, total }) => (
        <div key={field.id} className="rounded-lg bg-sunken px-3 py-2">
          <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">
            <Sigma size={11} /> {field.name} {field.totalMode === 'avg' ? 'avg' : 'total'}
          </div>
          <div className="text-lg font-semibold">{total === null ? '—' : formatNumber(field.type, total)}</div>
        </div>
      ))}
    </div>
  );
}

function VideoRow({ video, fields, boardId }: { video: Video; fields: Field[]; boardId: number }) {
  const [imgFailed, setImgFailed] = useState(false);
  const live = useBoard((s) => s.videos[video.id]) ?? video;
  const showThumb = live.thumbnail && !imgFailed;

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
      {fields.length > 0 && (
        <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {fields.map((f) => (
            <MetricInput key={f.id} field={f} video={live} boardId={boardId} />
          ))}
        </div>
      )}
    </div>
  );
}

function MetricInput({ field, video, boardId }: { field: Field; video: Video; boardId: number }) {
  const remote = video.values[field.id] ?? '';
  const { draft, setDraft, setEditing } = useDraft(remote);
  const numeric = isNumericType(field.type);

  function save() {
    setEditing(false);
    if (draft.trim() !== remote) void setVideoValue(boardId, video, field.id, draft.trim()).catch(() => {});
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
        />
        {field.type === 'percent' && <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-sm text-ink-subtle">%</span>}
      </span>
    </label>
  );
}
