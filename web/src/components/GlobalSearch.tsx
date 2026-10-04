import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import type { SearchResult } from '@triple-t/shared';
import { get } from '../lib/api';
import { cx } from './ui';

/** Search every board's cards (title, notes, banner text, comments) and jump to a result. */
export default function GlobalSearch({ onDark }: { onDark?: boolean }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await get<{ results: SearchResult[] }>(`/api/search?q=${encodeURIComponent(term)}`);
        setResults(res.results);
        setActive(0);
      } catch {
        setResults([]);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setExpanded(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  function go(r: SearchResult) {
    navigate(`/b/${r.boardId}?card=${r.cardId}`);
    setOpen(false);
    setExpanded(false);
    setQ('');
    inputRef.current?.blur();
  }

  return (
    <div ref={boxRef} className={cx('relative', expanded ? 'absolute inset-x-2 z-30 sm:static' : '')}>
      <button
        type="button"
        aria-label="Search"
        className={cx('flex h-9 w-9 items-center justify-center rounded sm:hidden', expanded && 'hidden', onDark ? 'text-white hover:bg-white/20' : 'text-ink hover:bg-hover')}
        onClick={() => {
          setExpanded(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
      >
        <Search size={18} />
      </button>
      <div className={cx('relative', expanded ? 'block' : 'hidden sm:block')}>
        <Search size={15} className={cx('pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2', onDark ? 'text-white/80' : 'text-ink-subtle')} />
        <input
          ref={inputRef}
          type="search"
          value={q}
          placeholder="Search all boards"
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, results.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === 'Enter' && results[active]) {
              go(results[active]);
            } else if (e.key === 'Escape') {
              setOpen(false);
              setExpanded(false);
              inputRef.current?.blur();
            }
          }}
          className={cx(
            'h-9 w-full rounded-md border pl-8 pr-8 text-base outline-none sm:h-8 sm:w-64 sm:text-sm sm:focus:w-80 transition-[width]',
            onDark
              ? 'border-white/30 bg-white/20 text-white placeholder:text-white/80 focus:bg-raised focus:text-ink focus:placeholder:text-ink-subtle'
              : 'border-line bg-card text-ink placeholder:text-ink-subtle focus:border-accent',
          )}
        />
        {expanded && (
          <button
            type="button"
            aria-label="Close search"
            className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center text-ink-subtle sm:hidden"
            onClick={() => {
              setExpanded(false);
              setOpen(false);
            }}
          >
            <X size={16} />
          </button>
        )}
      </div>
      {open && q.trim().length >= 2 && (
        <div className="animate-pop absolute right-0 top-11 z-50 max-h-[70vh] w-full overflow-y-auto rounded-lg bg-raised p-1 text-ink shadow-pop sm:top-10 sm:w-96">
          {results.length === 0 ? (
            <p className="px-3 py-4 text-sm text-ink-subtle">No cards match “{q.trim()}”.</p>
          ) : (
            results.map((r, i) => (
              <button
                key={r.cardId}
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => go(r)}
                className={cx('block w-full rounded px-3 py-2 text-left', i === active && 'bg-hover')}
              >
                <div className="truncate text-sm font-medium">{r.title}</div>
                <div className="truncate text-xs text-ink-subtle">
                  {r.boardName} · {r.columnName}
                </div>
                {r.snippet && <div className="mt-0.5 line-clamp-2 text-xs text-ink-subtle">{r.snippet}</div>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
