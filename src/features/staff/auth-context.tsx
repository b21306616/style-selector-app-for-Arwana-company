import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { recoverStaff, setupStaff, staffStatus, unlockStaff } from '../../storage/staff-auth';

interface StaffAuth {
  configured: boolean | null;
  unlocked: boolean;
  busy: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  unlock: (pin: string) => Promise<void>;
  setup: (pin: string) => Promise<string>;
  recover: (code: string, pin: string) => Promise<string>;
  lock: () => void;
}
const Context = createContext<StaffAuth | null>(null);
export function StaffAuthProvider({ children }: PropsWithChildren) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const epoch = useRef(0);
  const pending = useRef(false);
  const lock = useCallback(() => { epoch.current += 1; setUnlocked(false); }, []);
  const refresh = useCallback(async () => {
    try { setConfigured((await staffStatus()).configured); setError(null); }
    catch { setError('AUTH_STORAGE'); }
  }, []);
  useEffect(() => {
    let active = true;
    void staffStatus().then(status => {
      if (active) { setConfigured(status.configured); setError(null); }
    }).catch(() => { if (active) setError('AUTH_STORAGE'); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => { if (state === 'background') lock(); });
    return () => subscription.remove();
  }, [lock]);
  async function action<T>(work: () => Promise<T>, allowUnlock: boolean) {
    if (pending.current) throw new Error('BUSY');
    const started = epoch.current;
    pending.current = true; setBusy(true);
    try {
      const result = await work();
      setConfigured(true);
      if (allowUnlock && epoch.current === started) setUnlocked(true);
      return result;
    } finally { pending.current = false; setBusy(false); }
  }
  return <Context.Provider value={{ configured, unlocked, busy, error, refresh, lock,
    unlock: pin => action(() => unlockStaff(pin), true),
    setup: pin => action(() => setupStaff(pin), false),
    recover: (code, pin) => action(() => recoverStaff(code, pin), false),
  }}>{children}</Context.Provider>;
}
export function useStaffAuth() {
  const value = useContext(Context);
  if (!value) throw new Error('StaffAuthProvider missing');
  return value;
}
