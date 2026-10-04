import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ConfirmHost, ConnectionBanner, LogoMark, Toasts } from './components/ui';
import { setUnauthorizedHandler } from './lib/api';
import AdminUsers from './pages/AdminUsers';
import BoardPage from './pages/BoardPage';
import Home from './pages/Home';
import Login from './pages/Login';
import Profile from './pages/Profile';
import { useSession } from './stores/session';

export default function App() {
  const status = useSession((s) => s.status);
  const me = useSession((s) => s.me);

  useEffect(() => {
    setUnauthorizedHandler(() => useSession.getState().signedOut());
    void useSession.getState().init();
  }, []);

  if (status === 'loading') {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-pulse">
          <LogoMark size={56} />
        </div>
      </div>
    );
  }

  return (
    <>
      {status === 'signedOut' ? (
        <Login />
      ) : (
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/b/:boardId" element={<BoardPage />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/admin/users" element={me?.isAdmin ? <AdminUsers /> : <Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}
      {status === 'signedIn' && <ConnectionBanner />}
      <ConfirmHost />
      <Toasts />
    </>
  );
}
