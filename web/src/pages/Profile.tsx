import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { AVATAR_COLORS, type PublicUser } from '@triple-t/shared';
import AppHeader, { ThemeSwitch } from '../components/AppHeader';
import { Avatar, Button, cx, inputClass } from '../components/ui';
import { ApiError, patch, post } from '../lib/api';
import { useSession } from '../stores/session';
import { toast } from '../stores/ui';

export default function Profile() {
  const me = useSession((s) => s.me)!;
  const [displayName, setDisplayName] = useState(me.displayName);
  const [color, setColor] = useState(me.avatarColor);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Profile · Triple T';
  }, []);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    try {
      const { user } = await patch<{ user: PublicUser }>('/api/me', { displayName: displayName.trim(), avatarColor: color });
      useSession.getState().setMe(user);
      toast('Profile saved', 'info');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not save profile');
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    if (next !== confirm) return setPwError('New passwords don’t match');
    try {
      await post('/api/me/password', { currentPassword: current, newPassword: next });
      setCurrent('');
      setNext('');
      setConfirm('');
      toast('Password changed. Other devices were signed out.', 'info');
    } catch (err) {
      setPwError(err instanceof ApiError ? err.message : 'Could not change password');
    }
  }

  const label = 'mb-1 block text-xs font-semibold text-ink-subtle';
  return (
    <div className="flex min-h-full flex-col">
      <AppHeader />
      <main className="px-safe pb-safe mx-auto w-full max-w-lg flex-1 px-4 py-8">
        <h1 className="mb-6 text-xl font-bold">Your profile</h1>
        <form onSubmit={saveProfile} className="rounded-xl border border-line bg-raised p-5">
          <div className="mb-4 flex items-center gap-3">
            <Avatar user={{ displayName: displayName || me.displayName, avatarColor: color }} size={48} />
            <div className="text-sm text-ink-subtle">@{me.username}</div>
          </div>
          <label className={label} htmlFor="display-name">
            Display name
          </label>
          <input id="display-name" className={inputClass} value={displayName} maxLength={60} onChange={(e) => setDisplayName(e.target.value)} />
          <p className={label + ' mt-4'}>Avatar color</p>
          <div className="flex flex-wrap gap-2">
            {AVATAR_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                onClick={() => setColor(c)}
                className={cx('flex h-9 w-9 items-center justify-center rounded-full text-white', color === c && 'ring-2 ring-accent ring-offset-2 ring-offset-raised')}
                style={{ background: c }}
              >
                {color === c && <Check size={16} />}
              </button>
            ))}
          </div>
          <Button tone="primary" type="submit" className="mt-5" disabled={!displayName.trim()}>
            Save profile
          </Button>
        </form>

        <div className="mt-6 rounded-xl border border-line bg-raised p-5">
          <p className="mb-2 text-sm font-semibold">Appearance</p>
          <ThemeSwitch />
        </div>

        <form onSubmit={changePassword} className="mt-6 rounded-xl border border-line bg-raised p-5">
          <h2 className="mb-3 text-sm font-semibold">Change password</h2>
          <label className={label} htmlFor="pw-current">
            Current password
          </label>
          <input id="pw-current" type="password" autoComplete="current-password" className={inputClass + ' mb-3'} value={current} onChange={(e) => setCurrent(e.target.value)} required />
          <label className={label} htmlFor="pw-new">
            New password (at least 8 characters)
          </label>
          <input id="pw-new" type="password" autoComplete="new-password" minLength={8} className={inputClass + ' mb-3'} value={next} onChange={(e) => setNext(e.target.value)} required />
          <label className={label} htmlFor="pw-confirm">
            Confirm new password
          </label>
          <input id="pw-confirm" type="password" autoComplete="new-password" className={inputClass} value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          {pwError && <p className="mt-3 text-sm text-danger">{pwError}</p>}
          <Button tone="primary" type="submit" className="mt-4">
            Change password
          </Button>
        </form>
      </main>
    </div>
  );
}
