import { useState } from 'react';
import { ApiError } from '../lib/api';
import { useSession } from '../stores/session';
import { Button, LogoMark, inputClass } from '../components/ui';

export default function Login() {
  const login = useSession((s) => s.login);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not sign in');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pt-safe flex min-h-full flex-col items-center justify-center bg-[linear-gradient(135deg,#5b4bdb_0%,#1fb5c4_100%)] px-4 py-10">
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl bg-raised p-8 shadow-pop">
        <div className="mb-6 flex flex-col items-center gap-3">
          <LogoMark size={48} />
          <h1 className="text-xl font-bold">Triple T</h1>
          <p className="-mt-2 text-sm text-ink-subtle">TikTok Tracker</p>
        </div>
        <label className="mb-1 block text-xs font-semibold text-ink-subtle" htmlFor="username">
          Username
        </label>
        <input
          id="username"
          className={inputClass + ' mb-4 h-11 text-base sm:h-9 sm:text-sm'}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
          required
        />
        <label className="mb-1 block text-xs font-semibold text-ink-subtle" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          className={inputClass + ' mb-4 h-11 text-base sm:h-9 sm:text-sm'}
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && (
          <p role="alert" className="mb-4 rounded bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <Button tone="primary" type="submit" disabled={busy} className="h-11 w-full text-base sm:h-9 sm:text-sm">
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </div>
  );
}
