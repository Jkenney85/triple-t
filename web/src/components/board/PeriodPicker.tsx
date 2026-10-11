import { useMemo } from 'react';
import { CalendarRange, Check, ChevronDown } from 'lucide-react';
import { formatMonth, monthInTz, monthsWithData, shiftMonth } from '@triple-t/shared';
import { useBoard } from '../../stores/board';
import { useSession } from '../../stores/session';
import { Popover, cx, usePopover } from '../ui';

/**
 * Chooses which metrics the board shows: all time, or a single month.
 * Lists this month, the two before it, and any month that has numbers.
 */
export default function PeriodPicker({ variant }: { variant: 'bar' | 'inline' }) {
  const period = useBoard((s) => s.period);
  const setPeriod = useBoard((s) => s.setPeriod);
  const videos = useBoard((s) => s.videos);
  const tz = useSession((s) => s.tz);
  const pop = usePopover();

  const months = useMemo(() => {
    const current = monthInTz(new Date(), tz);
    const set = new Set([current, shiftMonth(current, -1), shiftMonth(current, -2), ...monthsWithData(Object.values(videos))]);
    if (period !== 'all') set.add(period);
    return [...set].sort().reverse();
  }, [videos, tz, period]);

  const label = period === 'all' ? 'All time' : formatMonth(period);

  return (
    <>
      <button
        type="button"
        onClick={pop.toggle}
        title="Which month's metrics to show"
        className={cx(
          'flex items-center gap-1.5 rounded text-sm font-medium',
          variant === 'bar'
            ? cx('h-9 px-2.5', period === 'all' ? 'text-white hover:bg-white/20' : 'bg-white/90 text-[#172b4d] hover:bg-white')
            : 'h-7 bg-hover px-2 text-xs font-semibold hover:brightness-95',
        )}
      >
        <CalendarRange size={variant === 'bar' ? 16 : 13} />
        <span className={variant === 'bar' ? 'hidden sm:inline' : ''}>{label}</span>
        <ChevronDown size={14} />
      </button>
      {pop.open && (
        <Popover anchor={pop.anchor} onClose={pop.close} title="Show metrics for" width={240}>
          {(['all', ...months] as string[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setPeriod(m);
                pop.close();
              }}
              className={cx('flex min-h-10 w-full items-center justify-between rounded px-2 text-left text-sm sm:min-h-8', period === m ? 'bg-accent text-accent-ink' : 'hover:bg-hover')}
            >
              {m === 'all' ? 'All time' : formatMonth(m, 'long')}
              {period === m && <Check size={14} />}
            </button>
          ))}
        </Popover>
      )}
    </>
  );
}
