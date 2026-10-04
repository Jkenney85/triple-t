import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  CalendarDays,
  Clock,
  CreditCard,
  ExternalLink,
  Link2,
  PaintBucket,
  Plus,
  Tag,
  Video as VideoIcon,
} from 'lucide-react';
import { DAYS, appendPosition, dayForColumn, dueStatus, sortCards, weekdayInTz, type Card } from '@triple-t/shared';
import { archiveCard, moveCard, updateCard } from '../../lib/actions';
import { formatDateTime, formatDue } from '../../lib/format';
import { useDraft } from '../../lib/useDraft';
import { useBoard } from '../../stores/board';
import { useSession } from '../../stores/session';
import { toast } from '../../stores/ui';
import { Avatar, Button, Modal, ModalClose, cx, inputClass, usePopover } from '../ui';
import { Banner, LabelPill } from './CardFront';
import { BannerPopover, DayPopover, DuePopover, LabelsPopover } from './CardPopovers';
import CommentsSection from './CommentsSection';
import NotesEditor from './NotesEditor';
import VideosSection from './VideosSection';

export default function CardModal({ cardId, onClose }: { cardId: number; onClose: () => void }) {
  const card = useBoard((s) => s.cards[cardId]);
  const status = useBoard((s) => s.status);

  useEffect(() => {
    if (status === 'ready' && !card) {
      toast('That card was archived or no longer exists.', 'info');
      onClose();
    }
  }, [status, card, onClose]);

  return (
    <Modal open onClose={onClose} label={card?.title ?? 'Card'}>
      {card && <CardDetail card={card} onClose={onClose} />}
    </Modal>
  );
}

function CardDetail({ card, onClose }: { card: Card; onClose: () => void }) {
  const columns = useBoard((s) => s.columns);
  const labelsById = useBoard((s) => s.labels);
  const fieldsById = useBoard((s) => s.fields);
  const allVideos = useBoard((s) => s.videos);
  const allComments = useBoard((s) => s.comments);
  const allCards = useBoard((s) => s.cards);
  const users = useSession((s) => s.users);
  const tz = useSession((s) => s.tz);

  const column = columns[card.columnId];
  const inDone = !!column?.isDone;
  const labels = card.labelIds.map((id) => labelsById[id]).filter(Boolean);
  const fields = useMemo(() => Object.values(fieldsById).sort((a, b) => a.position - b.position), [fieldsById]);
  const videos = useMemo(
    () => Object.values(allVideos).filter((v) => v.cardId === card.id).sort((a, b) => a.position - b.position || a.id - b.id),
    [allVideos, card.id],
  );
  const comments = useMemo(() => Object.values(allComments).filter((c) => c.cardId === card.id), [allComments, card.id]);
  const sortedColumns = useMemo(() => Object.values(columns).sort((a, b) => a.position - b.position), [columns]);

  const bannerPop = usePopover();
  const labelsPop = usePopover();
  const dayPop = usePopover();
  const duePop = usePopover();
  const videoInputId = `video-url-${card.id}`;
  const linkRef = useRef<HTMLInputElement>(null);

  const isToday = card.dayOfWeek != null && card.dayOfWeek === weekdayInTz(new Date(), tz) && !inDone;
  const due = dueStatus(card.dueAt);

  function moveToColumn(columnId: number) {
    const target = columns[columnId];
    if (!target || target.id === card.columnId) return;
    const others = sortCards(Object.values(allCards).filter((c) => c.columnId === target.id && c.id !== card.id));
    const position = appendPosition(others, dayForColumn(card.dayOfWeek, target.isDone));
    void moveCard(card, target, position).catch(() => {});
  }

  const sideButton = 'flex h-9 w-full items-center gap-2 rounded-[3px] bg-hover px-3 text-left text-sm font-medium hover:brightness-95 sm:h-8';

  return (
    <div className="pb-safe">
      <ModalClose onClose={onClose} className={card.bannerColor ? 'bg-black/20 text-white hover:bg-black/40 hover:text-white' : ''} />
      {card.bannerColor && (
        <button type="button" className="block w-full text-left" onClick={bannerPop.toggle} aria-label="Edit banner">
          <Banner color={card.bannerColor} text={card.bannerText} size="modal" />
        </button>
      )}

      <div className={cx('px-4 pb-6 sm:px-6', card.bannerColor ? 'pt-4' : 'pt-5')}>
        <div className="flex gap-3 pr-10">
          <CreditCard size={20} className="mt-1.5 shrink-0 text-ink-subtle" />
          <div className="min-w-0 flex-1">
            <TitleEditor card={card} />
            <div className="mt-0.5 flex flex-wrap items-center gap-1 text-sm text-ink-subtle">
              in list
              <select
                aria-label="Move to list"
                value={card.columnId}
                onChange={(e) => moveToColumn(Number(e.target.value))}
                className="rounded bg-transparent px-1 py-0.5 font-medium text-ink underline decoration-dotted underline-offset-2 outline-none hover:bg-hover"
              >
                {sortedColumns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.isDone ? ' ✓' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-6 md:grid-cols-[1fr_176px]">
          <div className="flex min-w-0 flex-col gap-6 md:order-1">
            {/* Labels, day and due date */}
            <div className="flex flex-wrap gap-x-6 gap-y-4 sm:pl-8">
              <div>
                <h4 className="mb-1.5 text-xs font-semibold text-ink-subtle">Labels</h4>
                <div className="flex flex-wrap gap-1">
                  {labels.map((l) => (
                    <button key={l.id} type="button" onClick={labelsPop.toggle}>
                      <LabelPill label={l} />
                    </button>
                  ))}
                  <button type="button" aria-label="Edit labels" onClick={labelsPop.toggle} className="flex h-8 w-8 items-center justify-center rounded bg-hover hover:brightness-95">
                    <Plus size={16} />
                  </button>
                </div>
              </div>
              <div>
                <h4 className="mb-1.5 text-xs font-semibold text-ink-subtle">Day</h4>
                <button
                  type="button"
                  onClick={dayPop.toggle}
                  className={cx('flex h-8 items-center gap-1.5 rounded px-3 text-sm font-medium', isToday ? 'bg-[#f5cd47] text-[#533f04]' : 'bg-hover hover:brightness-95')}
                >
                  <CalendarDays size={15} />
                  {card.dayOfWeek != null ? DAYS[card.dayOfWeek] : inDone ? 'None (Done)' : 'No day'}
                  {isToday && ' · Today'}
                </button>
              </div>
              <div>
                <h4 className="mb-1.5 text-xs font-semibold text-ink-subtle">Due date</h4>
                <button
                  type="button"
                  onClick={duePop.toggle}
                  className={cx(
                    'flex h-8 items-center gap-1.5 rounded px-3 text-sm font-medium',
                    card.dueAt == null || inDone ? 'bg-hover hover:brightness-95' : '',
                    !inDone && due === 'overdue' && 'bg-[#c9372c] text-white',
                    !inDone && due === 'soon' && 'bg-[#f5cd47] text-[#533f04]',
                    !inDone && due === 'later' && 'bg-hover',
                  )}
                >
                  <Clock size={15} />
                  {card.dueAt != null ? formatDue(card.dueAt) : 'None'}
                  {!inDone && due === 'overdue' && <span className="rounded-sm bg-white/25 px-1 text-xs">Overdue</span>}
                  {!inDone && due === 'soon' && <span className="rounded-sm bg-black/10 px-1 text-xs">Due soon</span>}
                  {inDone && card.dueAt != null && <span className="rounded-sm bg-[#1f845a] px-1 text-xs text-white">Complete</span>}
                </button>
              </div>
            </div>

            <div className="sm:pl-0">
              <NotesEditor card={card} />
            </div>

            <ProductLink card={card} inputRef={linkRef} />

            <VideosSection card={card} videos={videos} fields={fields} inputId={videoInputId} />

            <CommentsSection card={card} comments={comments} />

            <div className="border-t border-line pt-3 text-xs text-ink-subtle">
              <MetaLine label="Created" userId={card.createdBy} at={card.createdAt} users={users} />
              <MetaLine label="Last edited" userId={card.updatedBy} at={card.updatedAt} users={users} />
            </div>
          </div>

          {/* Actions sidebar: first on phones (as chips), right-hand column on desktop */}
          <aside className="-order-1 md:order-2">
            <h4 className="mb-1.5 hidden text-xs font-semibold text-ink-subtle md:block">Add to card</h4>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-1">
              <button type="button" className={sideButton} onClick={labelsPop.toggle}>
                <Tag size={15} /> Labels
              </button>
              <button type="button" className={sideButton} onClick={bannerPop.toggle}>
                <PaintBucket size={15} /> Banner
              </button>
              <button type="button" className={sideButton} onClick={dayPop.toggle}>
                <CalendarDays size={15} /> Day
              </button>
              <button type="button" className={sideButton} onClick={duePop.toggle}>
                <Clock size={15} /> Due date
              </button>
              <button type="button" className={sideButton} onClick={() => linkRef.current?.focus()}>
                <Link2 size={15} /> Product link
              </button>
              <button type="button" className={sideButton} onClick={() => document.getElementById(videoInputId)?.focus()}>
                <VideoIcon size={15} /> Video
              </button>
            </div>
            <h4 className="mb-1.5 mt-4 hidden text-xs font-semibold text-ink-subtle md:block">Actions</h4>
            <button
              type="button"
              className={cx(sideButton, 'mt-2 md:mt-0')}
              onClick={() => {
                void archiveCard(card)
                  .then(() => toast('Card archived. Restore it from Archived items.', 'info'))
                  .catch(() => {});
                onClose();
              }}
            >
              <Archive size={15} /> Archive
            </button>
          </aside>
        </div>
      </div>

      {bannerPop.open && <BannerPopover card={card} anchor={bannerPop.anchor} onClose={bannerPop.close} />}
      {labelsPop.open && <LabelsPopover card={card} anchor={labelsPop.anchor} onClose={labelsPop.close} />}
      {dayPop.open && <DayPopover card={card} anchor={dayPop.anchor} onClose={dayPop.close} inDone={inDone} />}
      {duePop.open && <DuePopover card={card} anchor={duePop.anchor} onClose={duePop.close} />}
    </div>
  );
}

function TitleEditor({ card }: { card: Card }) {
  const { draft, setDraft, setEditing } = useDraft(card.title);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [draft]);

  function save() {
    setEditing(false);
    const t = draft.trim();
    if (!t) {
      toast('A card needs a title.');
      setDraft(card.title);
      return;
    }
    if (t !== card.title) void updateCard(card, { title: t }).catch(() => {});
  }

  return (
    <textarea
      ref={ref}
      rows={1}
      value={draft}
      maxLength={300}
      aria-label="Card title"
      onFocus={() => setEditing(true)}
      onChange={(e) => setDraft(e.target.value.replace(/\n/g, ''))}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          ref.current?.blur();
        }
        if (e.key === 'Escape') {
          e.stopPropagation();
          setDraft(card.title);
          setTimeout(() => ref.current?.blur());
        }
      }}
      className="-mx-1.5 block w-[calc(100%+12px)] resize-none overflow-hidden rounded-[3px] border-2 border-transparent bg-transparent px-1.5 py-0.5 text-xl font-semibold leading-7 text-ink outline-none focus:border-accent focus:bg-card"
    />
  );
}

function ProductLink({ card, inputRef }: { card: Card; inputRef: React.RefObject<HTMLInputElement | null> }) {
  const { draft, setDraft, editing, setEditing } = useDraft(card.productUrl);
  const [error, setError] = useState<string | null>(null);

  function save() {
    const v = draft.trim();
    if (v && !/^https?:\/\//i.test(v)) {
      setError('Links must start with http:// or https://');
      return;
    }
    setError(null);
    setEditing(false);
    if (v !== card.productUrl) void updateCard(card, { productUrl: v }).catch(() => {});
  }

  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <Link2 size={18} className="text-ink-subtle" />
        <h3 className="text-base font-semibold">Product link</h3>
      </div>
      {card.productUrl && !editing && (
        <div className="mb-2 flex items-center gap-2">
          <a
            href={card.productUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-accent hover:underline"
          >
            <ExternalLink size={14} className="shrink-0" />
            <span className="truncate">{card.productUrl.replace(/^https?:\/\//, '')}</span>
          </a>
        </div>
      )}
      <input
        ref={inputRef}
        className={inputClass + ' h-10 sm:h-9'}
        type="url"
        inputMode="url"
        autoCapitalize="none"
        autoCorrect="off"
        placeholder="https://shop.tiktok.com/…"
        value={draft}
        onFocus={() => setEditing(true)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </section>
  );
}

function MetaLine({
  label,
  userId,
  at,
  users,
}: {
  label: string;
  userId: number | null;
  at: number;
  users: Record<number, { displayName: string; avatarColor: string }>;
}) {
  const user = userId != null ? users[userId] : null;
  return (
    <div className="flex items-center gap-1.5 py-0.5">
      <Avatar user={user} size={18} />
      <span>
        {label} by <span className="font-semibold text-ink">{user?.displayName ?? 'Unknown'}</span> · {formatDateTime(at)}
      </span>
    </div>
  );
}
