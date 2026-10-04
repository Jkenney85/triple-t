import { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import type { Card, Comment } from '@triple-t/shared';
import { addComment, deleteComment, editComment } from '../../lib/actions';
import { formatDateTime, timeAgo } from '../../lib/format';
import { useSession } from '../../stores/session';
import Markdown from '../Markdown';
import { Avatar, Button, confirmDialog } from '../ui';

const textareaClass =
  'block w-full resize-y rounded-lg border-2 border-line bg-card px-3 py-2 text-base text-ink outline-none placeholder:text-ink-subtle focus:border-accent sm:text-sm';

export default function CommentsSection({ card, comments }: { card: Card; comments: Comment[] }) {
  const me = useSession((s) => s.me);
  const [body, setBody] = useState('');
  const [focused, setFocused] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!body.trim() || busy) return;
    setBusy(true);
    try {
      await addComment(card, body.trim());
      setBody('');
      setFocused(false);
    } catch {
      // toast shown
    } finally {
      setBusy(false);
    }
  }

  const sorted = [...comments].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <MessageSquare size={18} className="text-ink-subtle" />
        <h3 className="text-base font-semibold">Comments</h3>
      </div>
      <div className="flex gap-2.5">
        <Avatar user={me} size={32} />
        <div className="flex-1">
          <textarea
            className={textareaClass}
            rows={focused || body ? 3 : 1}
            placeholder="Write a comment…"
            value={body}
            maxLength={10000}
            onFocus={() => setFocused(true)}
            onBlur={() => !body && setFocused(false)}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void submit();
            }}
          />
          {(focused || body) && (
            <Button tone="primary" className="mt-2" disabled={!body.trim() || busy} onMouseDown={(e) => e.preventDefault()} onClick={() => void submit()}>
              Save
            </Button>
          )}
        </div>
      </div>
      <ul className="mt-4 flex flex-col gap-4">
        {sorted.map((c) => (
          <CommentItem key={c.id} comment={c} boardId={card.boardId} mine={c.userId === me?.id} />
        ))}
      </ul>
    </section>
  );
}

function CommentItem({ comment, boardId, mine }: { comment: Comment; boardId: number; mine: boolean }) {
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
      <Avatar user={author} size={32} />
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
