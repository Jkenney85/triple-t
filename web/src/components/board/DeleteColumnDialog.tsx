import { useState } from 'react';
import type { Column } from '@triple-t/shared';
import { deleteColumn } from '../../lib/actions';
import { Button, Modal, inputClass } from '../ui';

/** Deleting a list that still has cards asks where those cards should go first. */
export default function DeleteColumnDialog({
  column,
  columns,
  cardCount,
  onClose,
}: {
  column: Column;
  columns: Column[];
  cardCount: number;
  onClose: () => void;
}) {
  const others = columns.filter((c) => c.id !== column.id);
  const [moveTo, setMoveTo] = useState<number>(others[0]?.id ?? 0);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      await deleteColumn(column, cardCount > 0 || others.length ? moveTo : undefined);
      onClose();
    } catch {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} label="Delete list" width="max-w-sm" align="center">
      <div className="p-5">
        <h2 className="text-base font-semibold">Delete “{column.name}”?</h2>
        {cardCount > 0 ? (
          <>
            <p className="mt-2 text-sm text-ink-subtle">
              This list has {cardCount} card{cardCount === 1 ? '' : 's'}. Choose where to move {cardCount === 1 ? 'it' : 'them'}:
            </p>
            <select className={inputClass + ' mt-3 h-10'} value={moveTo} onChange={(e) => setMoveTo(Number(e.target.value))}>
              {others.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.isDone ? ' (Done — days will be cleared)' : ''}
                </option>
              ))}
            </select>
          </>
        ) : (
          <p className="mt-2 text-sm text-ink-subtle">The list is empty. Archived cards from it move to another list so they can still be restored.</p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button tone="danger" onClick={() => void confirm()} disabled={busy}>
            {cardCount > 0 ? 'Move cards & delete' : 'Delete list'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
