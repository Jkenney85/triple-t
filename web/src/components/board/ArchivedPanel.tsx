import { useEffect, useState } from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';
import { readableTextColor, type Board, type Card } from '@triple-t/shared';
import { deleteCard, restoreCard } from '../../lib/actions';
import { get } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { useBoard } from '../../stores/board';
import { Button, Drawer, confirmDialog, inputClass } from '../ui';

export default function ArchivedPanel({ board, onClose }: { board: Board; onClose: () => void }) {
  const version = useBoard((s) => s.archivedVersion);
  const columns = useBoard((s) => s.columns);
  const [cards, setCards] = useState<Card[] | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    let cancelled = false;
    get<{ cards: Card[] }>(`/api/boards/${board.id}/archived`)
      .then((res) => !cancelled && setCards(res.cards))
      .catch(() => !cancelled && setCards([]));
    return () => {
      cancelled = true;
    };
  }, [board.id, version]);

  const shown = (cards ?? []).filter((c) => c.title.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <Drawer title="Archived items" onClose={onClose}>
      <input className={inputClass} placeholder="Search archived cards…" value={q} onChange={(e) => setQ(e.target.value)} />
      {cards === null ? (
        <p className="py-6 text-center text-sm text-ink-subtle">Loading…</p>
      ) : shown.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-subtle">{cards.length ? 'No matches.' : 'No archived cards.'}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {shown.map((c) => (
            <li key={c.id}>
              <div className="overflow-hidden rounded-lg bg-card shadow-card">
                {c.bannerColor && (
                  <div className="px-3 py-1 text-xs font-semibold" style={{ background: c.bannerColor, color: readableTextColor(c.bannerColor) }}>
                    {c.bannerText || ' '}
                  </div>
                )}
                <div className="px-3 py-2">
                  <div className="text-sm">{c.title}</div>
                  <div className="mt-0.5 text-xs text-ink-subtle">
                    {columns[c.columnId]?.name ?? 'Unknown list'} · archived {c.archivedAt ? formatDateTime(c.archivedAt) : ''}
                  </div>
                </div>
              </div>
              <div className="mt-1.5 flex gap-2">
                <Button className="flex-1" onClick={() => void restoreCard(c).catch(() => {})}>
                  <RotateCcw size={14} /> Restore
                </Button>
                <Button
                  tone="danger"
                  className="flex-1"
                  onClick={async () => {
                    const ok = await confirmDialog({
                      title: 'Delete card permanently?',
                      message: `“${c.title}” and its videos, metric values and comments will be gone for good.`,
                      confirmLabel: 'Delete forever',
                      danger: true,
                    });
                    if (ok) void deleteCard(c).catch(() => {});
                  }}
                >
                  <Trash2 size={14} /> Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Drawer>
  );
}
