import { useState } from 'react';
import { ChevronDown, History, MessageSquare } from 'lucide-react';
import type { Card, Comment, Video } from '@triple-t/shared';
import { addVideoComment, deleteComment, editComment } from '../../lib/actions';
import { formatDateTime, timeAgo } from '../../lib/format';
import { useSession } from '../../stores/session';
import Markdown from '../Markdown';
import { Avatar, Button, confirmDialog, cx } from '../ui';

const textareaClass =
  'block w-full resize-y rounded-lg border-2 border-line bg-card px-3 py-2 text-base text-ink outline-none placeholder:text-ink-subtle focus:border-accent sm:text-sm';

const newestFirst = (comments: Comment[]) => [...comments].sort((a, b) => b.createdAt - a.createdAt);

/** Comment thread for one video, collapsed to a "Comments (n)" toggle until opened. */
export function VideoComments({ video, comments, boardId }: { video: Video; comments: Comment[]; boardId: number }) {
  const me = useSession((s) => s.me);
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!body.trim() || busy) return;
    setBusy(true);
    try {
      await addVideoComment(video, body.trim());
      setBody('');
    } catch {
      // toast shown
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2.5 border-t border-line pt-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-8 items-center gap-1.5 rounded px-1 text-xs font-semibold text-ink-subtle hover:text-ink"
      >
        <MessageSquare size={14} />
        {comments.length ? `Comments (${comments.length})` : 'Add a comment'}
        <ChevronDown size={14} className={cx('transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="mt-2">
          <div className="flex gap-2">
            <Avatar user={me} size={26} />
            <div className="flex-1">
              <textarea
                className={textareaClass}
                rows={body ? 3 : 1}
                autoFocus={comments.length === 0}
                placeholder="Comment on this video…"
                value={body}
                maxLength={10000}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void submit();
                }}
              />
              {body && (
                <Button tone="primary" className="mt-2" disabled={!body.trim() || busy} onClick={() => void submit()}>
                  Save
                </Button>
              )}
            </div>
          </div>
          <ul className="mt-3 flex flex-col gap-3">
            {newestFirst(comments).map((c) => (
              <CommentItem key={c.id} comment={c} boardId={boardId} mine={c.userId === me?.id} size={26} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Card-level comments from before comments moved onto videos. Read-only apart
 * from editing or deleting your own; only shown when a card has some.
 */
export function EarlierCardComments({ card, comments }: { card: Card; comments: Comment[] }) {
  const me = useSession((s) => s.me);
  if (comments.length === 0) return null;
  return (
    <section>
      <div className="mb-1 flex items-center gap-2">
        <History size={18} className="text-ink-subtle" />
        <h3 className="text-base font-semibold">Earlier comments</h3>
      </div>
      <p className="mb-3 text-xs text-ink-subtle">From before comments moved onto each video. New comments go on a video above.</p>
      <ul className="flex flex-col gap-4">
        {newestFirst(comments).map((c) => (
          <CommentItem key={c.id} comment={c} boardId={card.boardId} mine={c.userId === me?.id} />
        ))}
      </ul>
    </section>
  );
}

function CommentItem({ comment, boardId, mine, size = 32 }: { comment: Comment; boardId: number; mine: boolean; size?: number }) {
  const author = useSession((s) => s.users[comment.userId]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const edited = comment.updatedAt - comment.createdAt > 1000;

  async function save() {
    if (!draft.trim()) return;
    setEditing(false);
    if (draft.trim() !== comment.body) await editComment(boardId, comment, draft.trim()).catch(() => {});
  }

  return (
    <li className="flex gap-2.5">
      <Avatar user={author} size={size} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className="font-semibold">{author?.displayName ?? 'Former user'}</span>
          <span className="text-xs text-ink-subtle" title={formatDateTime(comment.createdAt)}>
            {timeAgo(comment.createdAt)}
            {edited && ' (edited)'}
          </span>
        </div>
        {editing ? (
          <div className="mt-1">
            <textarea className={textareaClass} rows={3} value={draft} autoFocus onChange={(e) => setDraft(e.target.value)} />
            <div className="mt-2 flex gap-2">
              <Button tone="primary" onClick={() => void save()} disabled={!draft.trim()}>
                Save
              </Button>
              <Button
                tone="ghost"
                onClick={() => {
                  setDraft(comment.body);
                  setEditing(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-1 rounded-lg bg-card px-3 py-2 shadow-card">
              <Markdown>{comment.body}</Markdown>
            </div>
            {mine && (
              <div className="mt-1 flex gap-3 text-xs text-ink-subtle">
                <button
                  type="button"
                  className="min-h-6 underline-offset-2 hover:underline"
                  onClick={() => {
                    setDraft(comment.body);
                    setEditing(true);
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="min-h-6 underline-offset-2 hover:underline"
                  onClick={async () => {
                    if (await confirmDialog({ title: 'Delete comment?', message: 'This can’t be undone.', confirmLabel: 'Delete', danger: true })) {
                      void deleteComment(boardId, comment.id).catch(() => {});
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </li>
  );
}
