import { useRef, useState } from 'react';
import { ArrowDown, ArrowDownLeft, ArrowDownRight, ArrowLeft, ArrowRight, ArrowUp, ArrowUpLeft, ArrowUpRight, ImagePlus, Trash2 } from 'lucide-react';
import { boardTheme, gradientValue, isHexColor, parseGradientValue, type Board } from '@triple-t/shared';
import { removeBoardBackground, updateBoard, uploadBoardBackground } from '../../lib/actions';
import { useBoards } from '../../stores/boards';
import { ThemePicker } from '../../pages/Home';
import { Button, confirmDialog, cx } from '../ui';

const MAX_MB = 25;

const DIRECTIONS = [
  { angle: 315, label: 'Up and left', icon: ArrowUpLeft },
  { angle: 0, label: 'Up', icon: ArrowUp },
  { angle: 45, label: 'Up and right', icon: ArrowUpRight },
  { angle: 270, label: 'Left', icon: ArrowLeft },
  { angle: 90, label: 'Right', icon: ArrowRight },
  { angle: 225, label: 'Down and left', icon: ArrowDownLeft },
  { angle: 180, label: 'Down', icon: ArrowDown },
  { angle: 135, label: 'Down and right', icon: ArrowDownRight },
];

const heading = 'mb-1.5 text-xs font-semibold text-ink-subtle';

export default function BackgroundPicker({ board }: { board: Board }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setColor = (color: string) => {
    if (color !== board.color) void updateBoard(board, { color }).then(() => useBoards.getState().load()).catch(() => {});
  };

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`That photo is ${(file.size / 1024 / 1024).toFixed(0)} MB. Photos must be under ${MAX_MB} MB.`);
      return;
    }
    setUploading(true);
    try {
      await uploadBoardBackground(board, file);
      void useBoards.getState().load();
    } catch {
      // toast already shown
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <section>
        <p className={heading}>Photo</p>
        {board.backgroundImage ? (
          <div className="overflow-hidden rounded-lg border border-line">
            <img src={board.backgroundImage.replace(/\.webp$/, '-thumb.webp')} alt="Current board photo" className="h-28 w-full object-cover" />
            <div className="flex gap-2 p-2">
              <Button className="flex-1" disabled={uploading} onClick={() => fileRef.current?.click()}>
                <ImagePlus size={15} /> {uploading ? 'Uploading…' : 'Change'}
              </Button>
              <Button
                className="flex-1"
                disabled={uploading}
                onClick={async () => {
                  if (await confirmDialog({ title: 'Remove the board photo?', message: 'The board goes back to its color background.', confirmLabel: 'Remove photo' })) {
                    void removeBoardBackground(board).then(() => useBoards.getState().load()).catch(() => {});
                  }
                }}
              >
                <Trash2 size={15} /> Remove
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="flex h-24 w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-line text-sm text-ink-subtle hover:border-accent hover:text-ink disabled:opacity-60"
          >
            <ImagePlus size={20} />
            {uploading ? 'Uploading…' : 'Upload a photo'}
            <span className="text-xs">JPEG, PNG or WebP, up to {MAX_MB} MB</span>
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          // Listing concrete types makes iPhones convert HEIC photos to JPEG on upload.
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
        {board.backgroundImage && <p className="mt-1.5 text-xs text-ink-subtle">The color below shows while the photo loads and tints the top bar.</p>}
      </section>

      <section>
        <ThemePicker value={board.color} onChange={setColor} />
      </section>

      <CustomBackground key={board.color} color={board.color} onApply={setColor} />
    </div>
  );
}

function CustomBackground({ color, onApply }: { color: string; onApply: (value: string) => void }) {
  const current = parseGradientValue(color);
  const base = boardTheme(color).base;
  const [mode, setMode] = useState<'gradient' | 'solid'>(isHexColor(color) ? 'solid' : 'gradient');
  const [from, setFrom] = useState(current?.from ?? '#5b4bdb');
  const [to, setTo] = useState(current?.to ?? '#1fb5c4');
  const [angle, setAngle] = useState(current?.angle ?? 135);
  const [solid, setSolid] = useState(isHexColor(color) ? color : base);

  const value = mode === 'gradient' ? gradientValue({ from, to, angle }) : solid.toLowerCase();
  const preview = boardTheme(value).background;

  return (
    <section>
      <p className={heading}>Custom</p>
      <div className="mb-3 grid grid-cols-2 gap-1 rounded-md bg-sunken p-1">
        {(['gradient', 'solid'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cx('h-8 rounded text-xs font-semibold capitalize', mode === m ? 'bg-raised shadow-card' : 'text-ink-subtle hover:text-ink')}
          >
            {m}
          </button>
        ))}
      </div>

      <div className="flex gap-3">
        <div className="h-[104px] w-[104px] shrink-0 rounded-lg shadow-card" style={{ background: preview }} aria-label="Preview" />
        {mode === 'gradient' ? (
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <ColorField label="From" value={from} onChange={setFrom} />
            <ColorField label="To" value={to} onChange={setTo} />
            <div className="grid grid-cols-4 gap-1" role="radiogroup" aria-label="Direction">
              {DIRECTIONS.map(({ angle: a, label, icon: Icon }) => (
                <button
                  key={a}
                  type="button"
                  role="radio"
                  aria-checked={angle === a}
                  aria-label={label}
                  title={label}
                  onClick={() => setAngle(a)}
                  className={cx('flex h-7 items-center justify-center rounded', angle === a ? 'bg-accent text-accent-ink' : 'bg-hover text-ink-subtle hover:text-ink')}
                >
                  <Icon size={14} />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="min-w-0 flex-1">
            <ColorField label="Color" value={solid} onChange={setSolid} />
          </div>
        )}
      </div>
      <Button tone="primary" className="mt-3 w-full" disabled={value === color} onClick={() => onApply(value)}>
        {value === color ? 'In use' : `Use this ${mode}`}
      </Button>
    </section>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [text, setText] = useState(value);
  return (
    <label className="flex items-center gap-2 text-xs text-ink-subtle">
      <input
        type="color"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setText(e.target.value);
        }}
        className="h-8 w-10 shrink-0 cursor-pointer rounded border border-line bg-transparent p-0.5"
        aria-label={`${label} color`}
      />
      <span className="w-9">{label}</span>
      <input
        value={text}
        maxLength={7}
        spellCheck={false}
        onChange={(e) => {
          setText(e.target.value);
          if (isHexColor(e.target.value)) onChange(e.target.value.toLowerCase());
        }}
        className="h-8 min-w-0 flex-1 rounded border-2 border-line bg-card px-2 font-mono text-base text-ink outline-none focus:border-accent sm:text-xs"
      />
    </label>
  );
}
