import { useEffect, useRef, useState } from 'react';

/**
 * Local editing state for a field that other people may change live.
 * While the user is editing, remote updates don't overwrite what they're typing;
 * `remoteChanged` tells the UI someone else edited it meanwhile (last write wins on save).
 */
export function useDraft<T>(remote: T) {
  const [draft, setDraft] = useState(remote);
  const [editing, setEditingState] = useState(false);
  const [remoteChanged, setRemoteChanged] = useState(false);
  const startValue = useRef(remote);

  useEffect(() => {
    if (!editing) {
      setDraft(remote);
      setRemoteChanged(false);
    } else if (remote !== startValue.current) {
      setRemoteChanged(true);
    }
  }, [remote, editing]);

  function setEditing(on: boolean) {
    if (on && !editing) startValue.current = remote;
    setEditingState(on);
  }

  return { draft, setDraft, editing, setEditing, remoteChanged };
}
