import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  MouseSensor,
  TouchSensor,
  closestCenter,
  getFirstCollision,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, horizontalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Plus, X } from 'lucide-react';
import {
  EMPTY_FILTER,
  POSITION_GAP,
  activeFilterCount,
  boardBackground,
  boardTheme,
  cardMatchesFilter,
  computeDropPosition,
  dayForColumn,
  sortCards,
  weekdayInTz,
  type CardFilter,
  type Column,
} from '@triple-t/shared';
import AppHeader from '../components/AppHeader';
import ArchivedPanel from '../components/board/ArchivedPanel';
import BoardBar from '../components/board/BoardBar';
import BoardSettings from '../components/board/BoardSettings';
import { CardFront, type CardFrontData } from '../components/board/CardFront';
import CardModal from '../components/board/CardModal';
import { ColumnView, cardKey, colKey } from '../components/board/ColumnView';
import DeleteColumnDialog from '../components/board/DeleteColumnDialog';
import { Button, LogoMark, cx } from '../components/ui';
import { createColumn, moveCard, updateColumn } from '../lib/actions';
import { useBoard } from '../stores/board';
import { useSession } from '../stores/session';

const isCol = (id: UniqueIdentifier) => String(id).startsWith('col-');
const numId = (id: UniqueIdentifier) => Number(String(id).split('-')[1]);

function useToday(tz: string) {
  const [today, setToday] = useState(() => weekdayInTz(new Date(), tz));
  useEffect(() => {
    const t = setInterval(() => setToday(weekdayInTz(new Date(), tz)), 60_000);
    setToday(weekdayInTz(new Date(), tz));
    return () => clearInterval(t);
  }, [tz]);
  return today;
}

export default function BoardPage() {
  const boardId = Number(useParams().boardId);
  const [params, setParams] = useSearchParams();
  const openCardId = params.get('card') ? Number(params.get('card')) : null;

  const { board, status, error, columns, cards, labels, fields, videos, comments } = useBoard();
  const tz = useSession((s) => s.tz);
  const today = useToday(tz);

  const [filter, setFilter] = useState<CardFilter>(EMPTY_FILTER);
  const [panel, setPanel] = useState<'settings' | 'archived' | null>(null);
  const [deleting, setDeleting] = useState<Column | null>(null);

  useEffect(() => {
    void useBoard.getState().open(boardId);
    setFilter(EMPTY_FILTER);
  }, [boardId]);

  useEffect(() => {
    if (board) document.title = `${board.name} · Triple T`;
  }, [board]);

  const theme = boardTheme(board?.color ?? 'ocean');
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute('content', theme.base);
    return () => meta?.setAttribute('content', '#5b4bdb');
  }, [theme.base]);

  // ---- Derived board view ----

  const sortedColumns = useMemo(() => Object.values(columns).sort((a, b) => a.position - b.position), [columns]);

  const { videosByCard, commentsByCard } = useMemo(() => {
    const v: Record<number, typeof videos[number][]> = {};
    for (const video of Object.values(videos)) (v[video.cardId] ??= []).push(video);
    const c: Record<number, typeof comments[number][]> = {};
    for (const comment of Object.values(comments)) (c[comment.cardId] ??= []).push(comment);
    return { videosByCard: v, commentsByCard: c };
  }, [videos, comments]);

  const frontFields = useMemo(
    () => Object.values(fields).filter((f) => f.showOnFront).sort((a, b) => a.position - b.position),
    [fields],
  );

  const cardData = useMemo(() => {
    const out: Record<number, CardFrontData> = {};
    for (const card of Object.values(cards)) {
      const vids = videosByCard[card.id] ?? [];
      const values: Record<number, string[]> = {};
      for (const f of frontFields) values[f.id] = vids.map((v) => v.values[f.id]).filter((x): x is string => x != null);
      const inDone = !!columns[card.columnId]?.isDone;
      out[card.id] = {
        card,
        labels: card.labelIds.map((id) => labels[id]).filter(Boolean),
        frontFields,
        values,
        commentCount: commentsByCard[card.id]?.length ?? 0,
        videoCount: vids.length,
        isToday: card.dayOfWeek === today && !inDone,
        inDone,
      };
    }
    return out;
  }, [cards, labels, frontFields, videosByCard, commentsByCard, columns, today]);

  const { visibleByColumn, totalByColumn } = useMemo(() => {
    const visible: Record<number, number[]> = {};
    const total: Record<number, number> = {};
    for (const col of sortedColumns) {
      visible[col.id] = [];
      total[col.id] = 0;
    }
    const now = Date.now();
    for (const card of sortCards(Object.values(cards))) {
      if (!(card.columnId in visible)) continue;
      total[card.columnId]++;
      if (cardMatchesFilter(card, filter, { comments: commentsByCard[card.id] ?? [], videos: videosByCard[card.id] ?? [], now })) {
        visible[card.columnId].push(card.id);
      }
    }
    return { visibleByColumn: visible, totalByColumn: total };
  }, [cards, sortedColumns, filter, commentsByCard, videosByCard]);

  // ---- Drag and drop ----

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  /** Card order per column while a card drag is in progress (lets the card preview in another list). */
  const [dragItems, setDragItems] = useState<Record<number, number[]> | null>(null);
  const lastOverId = useRef<UniqueIdentifier | null>(null);
  const lastDragEnd = useRef(0);
  const items = dragItems ?? visibleByColumn;

  const findColumn = useCallback(
    (id: UniqueIdentifier): number | undefined => {
      if (isCol(id)) return numId(id);
      const cardId = numId(id);
      return Object.keys(items)
        .map(Number)
        .find((colId) => items[colId].includes(cardId));
    },
    [items],
  );

  const collisionDetection: CollisionDetection = useCallback(
    (args) => {
      if (activeId && isCol(activeId)) {
        return closestCenter({ ...args, droppableContainers: args.droppableContainers.filter((c) => isCol(c.id)) });
      }
      const pointer = pointerWithin(args);
      const hits = pointer.length > 0 ? pointer : rectIntersection(args);
      let overId = getFirstCollision(hits, 'id');
      if (overId != null) {
        if (isCol(overId)) {
          const colCards = items[numId(overId)] ?? [];
          if (colCards.length > 0) {
            const keys = new Set(colCards.map(cardKey));
            overId =
              closestCenter({ ...args, droppableContainers: args.droppableContainers.filter((c) => keys.has(String(c.id))) })[0]?.id ??
              overId;
          }
        }
        lastOverId.current = overId;
        return [{ id: overId }];
      }
      return lastOverId.current ? [{ id: lastOverId.current }] : [];
    },
    [activeId, items],
  );

  function onDragStart({ active }: DragStartEvent) {
    setActiveId(active.id);
    if (!isCol(active.id)) setDragItems(visibleByColumn);
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over || isCol(active.id) || !dragItems) return;
    const from = findColumn(active.id);
    const to = findColumn(over.id);
    if (from == null || to == null || from === to) return;
    setDragItems((prev) => {
      if (!prev) return prev;
      const cardId = numId(active.id);
      const target = prev[to];
      let index = target.length;
      if (!isCol(over.id)) {
        const overIndex = target.indexOf(numId(over.id));
        const below =
          active.rect.current.translated && active.rect.current.translated.top > over.rect.top + over.rect.height / 2;
        index = overIndex >= 0 ? overIndex + (below ? 1 : 0) : target.length;
      }
      return {
        ...prev,
        [from]: prev[from].filter((id) => id !== cardId),
        [to]: [...target.slice(0, index), cardId, ...target.slice(index)],
      };
    });
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    lastDragEnd.current = Date.now();
    const finalItems = dragItems;
    setActiveId(null);
    setDragItems(null);
    lastOverId.current = null;
    if (!over) return;

    if (isCol(active.id)) {
      const ids = sortedColumns.map((c) => c.id);
      const from = ids.indexOf(numId(active.id));
      const to = ids.indexOf(numId(over.id));
      if (from < 0 || to < 0 || from === to) return;
      const reordered = arrayMove(sortedColumns, from, to);
      const prev = reordered[to - 1];
      const next = reordered[to + 1];
      const position =
        prev && next ? (prev.position + next.position) / 2 : prev ? prev.position + POSITION_GAP : next.position - POSITION_GAP;
      void updateColumn(reordered[to], { position }).catch(() => {});
      return;
    }

    if (!finalItems) return;
    const cardId = numId(active.id);
    const card = cards[cardId];
    const colId = Object.keys(finalItems)
      .map(Number)
      .find((c) => finalItems[c].includes(cardId));
    if (!card || colId == null) return;
    let list = finalItems[colId];
    if (!isCol(over.id)) {
      const oldIndex = list.indexOf(cardId);
      const newIndex = list.indexOf(numId(over.id));
      if (newIndex >= 0 && oldIndex !== newIndex) list = arrayMove(list, oldIndex, newIndex);
    }
    const column = columns[colId];
    const index = list.indexOf(cardId);
    const others = list.filter((id) => id !== cardId).map((id) => cards[id]);
    // Dragging never changes the day: the drop snaps into the card's own day group.
    const day = dayForColumn(card.dayOfWeek, column.isDone);
    const position = computeDropPosition(others, index, day);
    // Dropped back where it started: nothing to save.
    if (colId === card.columnId && list.join() === (visibleByColumn[colId] ?? []).join()) return;
    void moveCard(card, column, position).catch(() => {});
  }

  const openCard = useCallback(
    (id: number) => {
      if (Date.now() - lastDragEnd.current < 200) return;
      setParams((p) => {
        p.set('card', String(id));
        return p;
      });
    },
    [setParams],
  );

  const closeCard = useCallback(() => {
    setParams((p) => {
      p.delete('card');
      return p;
    });
  }, [setParams]);

  // ---- Render ----

  if (status === 'error') {
    return (
      <div className="flex h-full flex-col">
        <AppHeader />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="font-semibold">{error ?? 'Board not found'}</p>
          <Button onClick={() => void useBoard.getState().reload()}>Try again</Button>
        </div>
      </div>
    );
  }

  const activeCard = activeId && !isCol(activeId) ? cardData[numId(activeId)] : null;
  const activeColumn = activeId && isCol(activeId) ? columns[numId(activeId)] : null;
  const filtersOn = activeFilterCount(filter) > 0;

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: board ? boardBackground(board) : theme.background }}>
      <AppHeader onDark />
      {board ? (
        <>
          <BoardBar
            board={board}
            filter={filter}
            onFilter={setFilter}
            onOpenPanel={setPanel}
          />
          {board.archivedAt && (
            <div className="bg-[#f5cd47] px-4 py-2 text-center text-sm font-medium text-[#533f04]">
              This board is archived. Restore it from board settings to keep it in your boards list.
            </div>
          )}
          <DndContext
            sensors={sensors}
            collisionDetection={collisionDetection}
            measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragEnd={onDragEnd}
            onDragCancel={() => {
              setActiveId(null);
              setDragItems(null);
            }}
          >
            {/* Outer element scrolls; the inner row is centered with auto margins, which
                collapse to zero once the lists are wider than the screen (no clipping). */}
            <div
              className={cx(
                'board-scroll flex min-h-0 flex-1 overflow-x-auto overflow-y-hidden scroll-pl-[max(0.75rem,env(safe-area-inset-left))]',
                !activeId && 'snap-x snap-mandatory sm:snap-none',
              )}
            >
              <div className="mx-auto flex h-full w-max items-start gap-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pt-1">
              <SortableContext items={sortedColumns.map((c) => colKey(c.id))} strategy={horizontalListSortingStrategy}>
                {sortedColumns.map((col) => (
                  <ColumnView
                    key={col.id}
                    column={col}
                    cardIds={items[col.id] ?? []}
                    cardData={cardData}
                    totalCount={totalByColumn[col.id] ?? 0}
                    onOpenCard={openCard}
                    onDeleteColumn={setDeleting}
                  />
                ))}
              </SortableContext>
              <AddColumn boardId={board.id} photo={!!board.backgroundImage} />
              </div>
            </div>
            <DragOverlay dropAnimation={null}>
              {activeCard ? (
                <div className="w-[calc(85vw-16px)] cursor-grabbing sm:w-[256px]">
                  <CardFront data={activeCard} dragging />
                </div>
              ) : activeColumn ? (
                <div className="w-[85vw] rotate-2 rounded-xl bg-list p-3 font-semibold text-ink opacity-90 shadow-pop sm:w-[272px]">
                  {activeColumn.name}
                  <div className="mt-1 text-xs font-normal text-ink-subtle">{totalByColumn[activeColumn.id] ?? 0} cards</div>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
          {filtersOn && (
            <div className="pb-safe pointer-events-none fixed inset-x-0 bottom-3 z-10 flex justify-center">
              <button
                type="button"
                onClick={() => setFilter(EMPTY_FILTER)}
                className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-[#172b4d] px-4 py-2 text-sm font-medium text-white shadow-pop"
              >
                Filters on — showing matching cards <X size={14} />
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <div className="animate-pulse">
            <LogoMark size={48} />
          </div>
        </div>
      )}

      {board && openCardId != null && <CardModal cardId={openCardId} onClose={closeCard} />}
      {board && panel === 'settings' && <BoardSettings board={board} onClose={() => setPanel(null)} />}
      {board && panel === 'archived' && <ArchivedPanel board={board} onClose={() => setPanel(null)} />}
      {deleting && (
        <DeleteColumnDialog
          column={deleting}
          columns={sortedColumns}
          cardCount={totalByColumn[deleting.id] ?? 0}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

function AddColumn({ boardId, photo }: { boardId: number; photo: boolean }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  async function submit() {
    const n = name.trim();
    if (!n) return;
    try {
      await createColumn(boardId, n);
      setName('');
    } catch {
      // toast shown
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cx(
          'flex h-12 w-[85vw] shrink-0 snap-start items-center gap-2 rounded-xl px-3 text-sm font-medium text-white sm:w-[272px]',
          photo ? 'bg-black/40 backdrop-blur-sm hover:bg-black/50' : 'bg-white/25 hover:bg-white/35',
        )}
      >
        <Plus size={16} /> Add another list
      </button>
    );
  }
  return (
    <div className="w-[85vw] shrink-0 snap-start rounded-xl bg-list p-2 shadow-card sm:w-[272px]">
      <input
        autoFocus
        value={name}
        maxLength={80}
        placeholder="Enter list name…"
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void submit();
          if (e.key === 'Escape') setOpen(false);
        }}
        className="h-9 w-full rounded-[3px] border-2 border-accent bg-card px-2 text-base text-ink outline-none sm:text-sm"
      />
      <div className="mt-2 flex items-center gap-1">
        <Button tone="primary" onClick={() => void submit()} disabled={!name.trim()}>
          Add list
        </Button>
        <button type="button" aria-label="Cancel" className="flex h-8 w-8 items-center justify-center rounded text-ink-subtle hover:bg-hover" onClick={() => setOpen(false)}>
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
