import { useState } from 'react';
import { Check } from 'lucide-react';
import { LABEL_COLORS, isHexColor, type Column } from '@triple-t/shared';
import { updateColumn } from '../../lib/actions';
import { Button, cx } from '../ui';

/** Background for a list: its color blended into the theme's list gray (pastel in light mode, deep in dark mode). */
export function columnBackground(color: string | null): string | undefined {
  return color ? `color-mix(in srgb, ${color} var(--list-tint), var(--list))` : undefined;
}

export default function ColumnColorPicker({ column, onDone }: { column: Column; onDone?: () => void }) {
  const [custom, setCustom] = useState(column.color ?? '#579dff');

  const pick = (color: string | null) => {
    if (color !== column.color) void updateColumn(column, { color }).catch(() => {});
    onDone?.();
  };

  return (
    <div>
      <div className="mb-3 overflow-hidden rounded-lg p-2 shadow-card" style={{ background: columnBackground(column.color) ?? 'var(--list)' }}>
        <div className="px-1 pb-1.5 text-sm font-semibold">{column.name}</div>
        <div className="h-8 rounded-md bg-card shadow-card" />
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {LABEL_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={c}
            aria-pressed={column.color === c}
            onClick={() => pick(c)}
            className={cx('flex h-8 items-center justify-center rounded text-white', column.color === c && 'ring-2 ring-accent ring-offset-2 ring-offset-raised')}
            style={{ background: c }}
          >
            {column.color === c && <Check size={14} className="drop-shadow" />}
          </button>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input
          type="color"
          aria-label="Custom list color"
          value={isHexColor(custom) ? custom : '#579dff'}
          onChange={(e) => setCustom(e.target.value)}
          className="h-9 w-12 shrink-0 cursor-pointer rounded border border-line bg-transparent p-0.5"
        />
        <Button className="flex-1" disabled={!isHexColor(custom) || custom.toLowerCase() === column.color} onClick={() => pick(custom.toLowerCase())}>
          Use custom color
        </Button>
      </div>
      <Button className="mt-2 w-full" disabled={!column.color} onClick={() => pick(null)}>
        No color
      </Button>
    </div>
  );
}
