import { useEffect, useState } from 'react';
import { KeyRound, ShieldCheck, UserPlus } from 'lucide-react';
import type { PublicUser } from '@triple-t/shared';
import AppHeader from '../components/AppHeader';
import { Avatar, Button, Modal, cx, inputClass } from '../components/ui';
import { ApiError, get, patch, post } from '../lib/api';
import { useSession } from '../stores/session';
import { toast } from '../stores/ui';

export default function AdminUsers() {
  const me = useSession((s) => s.me)!;
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState<PublicUser | null>(null);

  async function load() {
    const res = await get<{ users: PublicUser[] }>('/api/admin/users');
    setUsers(res.users);
  }

  useEffect(() => {
    document.title = 'Users · Triple T';
    void load();
  }, []);

  async function update(u: PublicUser, changes: Partial<PublicUser>) {
    try {
      await patch(`/api/admin/users/${u.id}`, changes);
      await load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not update user');
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader />
      <main className="px-safe pb-safe mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <div className="mb-5 flex items-center gap-3">
          <h1 className="flex-1 text-xl font-bold">Users</h1>
          <Button tone="primary" onClick={() => setCreating(true)}>
            <UserPlus size={16} /> Add user
          </Button>
        </div>
        <p className="mb-4 text-sm text-ink-subtle">There’s no public sign-up. Everyone here can see and edit every board.</p>
        <ul className="divide-y divide-line rounded-xl border border-line bg-raised">
          {users.map((u) => (
            <li key={u.id} className={cx('flex flex-wrap items-center gap-3 px-4 py-3', !u.isActive && 'opacity-60')}>
              <Avatar user={u} size={36} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 font-semibold">
                  {u.displayName}
                  {u.isAdmin && <ShieldCheck size={15} className="text-accent" aria-label="Admin" />}
                  {!u.isActive && <span className="rounded bg-hover px-1.5 text-xs font-medium">Deactivated</span>}
                </div>
                <div className="text-xs text-ink-subtle">@{u.username}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setResetting(u)}>
                  <KeyRound size={14} /> Reset password
                </Button>
                {u.id !== me.id && (
                  <>
                    <Button onClick={() => void update(u, { isAdmin: !u.isAdmin })}>{u.isAdmin ? 'Remove admin' : 'Make admin'}</Button>
                    <Button tone={u.isActive ? 'subtle' : 'primary'} onClick={() => void update(u, { isActive: !u.isActive })}>
                      {u.isActive ? 'Deactivate' : 'Reactivate'}
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      </main>
      {creating && <CreateUser onClose={() => setCreating(false)} onCreated={() => void load()} />}
      {resetting && <ResetPassword user={resetting} onClose={() => setResetting(null)} />}
    </div>
  );
}

function CreateUser({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await post('/api/admin/users', { username: username.trim(), displayName: displayName.trim(), password, isAdmin });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create user');
    }
  }

  const label = 'mb-1 block text-xs font-semibold text-ink-subtle';
  return (
    <Modal open onClose={onClose} label="Add user" width="max-w-sm" align="center">
      <form onSubmit={submit} className="p-5">
        <h2 className="mb-4 text-base font-semibold">Add user</h2>
        <label className={label}>Username</label>
        <input className={inputClass + ' mb-3'} value={username} autoCapitalize="none" onChange={(e) => setUsername(e.target.value)} required autoFocus />
        <label className={label}>Display name</label>
        <input className={inputClass + ' mb-3'} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Optional" />
        <label className={label}>Temporary password (8+ characters)</label>
        <input className={inputClass + ' mb-3'} type="password" autoComplete="new-password" value={password} minLength={8} onChange={(e) => setPassword(e.target.value)} required />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} className="h-4 w-4" /> Admin
        </label>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button tone="primary" type="submit">
            Create user
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ResetPassword({ user, onClose }: { user: PublicUser; onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await patch(`/api/admin/users/${user.id}`, { password });
      toast(`Password reset for ${user.displayName}. They’ve been signed out everywhere.`, 'info');
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reset password');
    }
  }

  return (
    <Modal open onClose={onClose} label="Reset password" width="max-w-sm" align="center">
      <form onSubmit={submit} className="p-5">
        <h2 className="mb-4 text-base font-semibold">Reset password for {user.displayName}</h2>
        <input className={inputClass} type="password" autoComplete="new-password" placeholder="New password (8+ characters)" value={password} minLength={8} onChange={(e) => setPassword(e.target.value)} required autoFocus />
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button tone="primary" type="submit">
            Reset password
          </Button>
        </div>
      </form>
    </Modal>
  );
}
