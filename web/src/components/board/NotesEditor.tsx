import { useRef, useState } from 'react';
import { Bold, Code, Heading2, Italic, Link2, List, ListChecks, ListOrdered, Text } from 'lucide-react';
import type { Card } from '@triple-t/shared';
import { updateCard } from '../../lib/actions';
import { useDraft } from '../../lib/useDraft';
import Markdown from '../Markdown';
import { Button, IconButton, cx } from '../ui';

type Wrap = { before: string; after?: string; line?: boolean; placeholder?: string };

const TOOLS: { label: string; icon: React.ReactNode; wrap: Wrap }[] = [
  { label: 'Bold', icon: <Bold size={15} />, wrap: { before: '**', after: '**', placeholder: 'bold' } },
  { label: 'Italic', icon: <Italic size={15} />, wrap: { before: '_', after: '_', placeholder: 'italic' } },
  { label: 'Heading', icon: <Heading2 size={15} />, wrap: { before: '## ', line: true, placeholder: 'Heading' } },
  { label: 'Bulleted list', icon: <List size={15} />, wrap: { before: '- ', line: true, placeholder: 'item' } },
  { label: 'Numbered list', icon: <ListOrdered size={15} />, wrap: { before: '1. ', line: true, placeholder: 'item' } },
  { label: 'Checklist', icon: <ListChecks size={15} />, wrap: { before: '- [ ] ', line: true, placeholder: 'to do' } },
  { label: 'Link', icon: <Link2 size={15} />, wrap: { before: '[', after: '](https://)', placeholder: 'link text' } },
  { label: 'Code', icon: <Code size={15} />, wrap: { before: '`', after: '`', placeholder: 'code' } },
];

export default function NotesEditor({ card }: { card: Card }) {
  const { draft, setDraft, editing, setEditing, remoteChanged } = useDraft(card.notes);
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const ref = useRef<HTMLTextAreaElement>(null);

  function apply({ before, after = '', line, placeholder = '' }: Wrap) {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e, value } = el;
    let start = s;
    if (line) start = value.lastIndexOf('\n', s - 1) + 1;
    const selected = value.slice(s, e) || placeholder;
    const next = line
      ? value.slice(0, start) + before + value.slice(start, s) + selected + value.slice(e)
      : value.slice(0, s) + before + selected + after + value.slice(e);
    setDraft(next);
    requestAnimationFrame(() => {
      el.focus();
      const caret = (line ? start + before.length + (s - start) : s + before.length);
      el.setSelectionRange(caret, caret + selected.length);
    });
  }

  function save() {
    setEditing(false);
    setTab('write');
    if (draft !== card.notes) void updateCard(card, { notes: draft }).catch(() => {});
  }

  function cancel() {
    setDraft(card.notes);
    setEditing(false);
    setTab('write');
  }

  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <Text size={18} className="text-ink-subtle" />
        <h3 className="flex-1 text-base font-semibold">Notes</h3>
        {!editing && card.notes && (
          <Button onClick={() => setEditing(true)}>Edit</Button>
        )}
      </div>
      {editing ? (
        <div className="rounded-lg border-2 border-accent bg-card">
          <div className="flex flex-wrap items-center gap-0.5 border-b border-line px-1 py-1">
            {(['write', 'preview'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cx('h-8 rounded px-2.5 text-xs font-semibold capitalize', tab === t ? 'bg-hover text-ink' : 'text-ink-subtle')}
              >
                {t}
              </button>
            ))}
            <span className="mx-1 h-5 w-px bg-line" />
            {TOOLS.map((t) => (
              <IconButton key={t.label} label={t.label} disabled={tab !== 'write'} onMouseDown={(e) => e.preventDefault()} onClick={() => apply(t.wrap)}>
                {t.icon}
              </IconButton>
            ))}
          </div>
          {tab === 'write' ? (
            <textarea
              ref={ref}
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.stopPropagation();
                  cancel();
                }
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save();
              }}
              rows={8}
              placeholder="Add notes… Markdown is supported."
              className="block min-h-40 w-full resize-y bg-transparent px-3 py-2 font-mono text-base text-ink outline-none sm:text-[13px]"
            />
          ) : (
            <div className="min-h-40 px-3 py-2">{draft.trim() ? <Markdown>{draft}</Markdown> : <p className="text-sm text-ink-subtle">Nothing to preview.</p>}</div>
          )}
        </div>
      ) : card.notes ? (
        <div role="button" tabIndex={0} onClick={(e) => { if (!(e.target as HTMLElement).closest('a,input')) setEditing(true); }} onKeyDown={(e) => e.key === 'Enter' && setEditing(true)} className="cursor-text rounded-lg px-1 py-1 hover:bg-hover/50">
          <Markdown>{card.notes}</Markdown>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="block min-h-14 w-full rounded-lg bg-hover px-3 py-2 text-left text-sm text-ink-subtle hover:brightness-95"
        >
          Add notes… (Markdown supported)
        </button>
      )}
      {editing && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button tone="primary" onClick={save}>
            Save
          </Button>
          <Button tone="ghost" onClick={cancel}>
            Cancel
          </Button>
          {remoteChanged && <span className="text-xs text-[#a54800] dark:text-[#fea362]">Someone else just edited these notes. Saving will replace their version.</span>}
        </div>
      )}
    </section>
  );
}
