// Acceso seguro a localStorage / sessionStorage (puede fallar en modo privado)
type Store = 'local' | 'session';

const getStore = (s: Store): Storage | null => {
  try {
    return s === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
};

export function safeGet(key: string, store: Store = 'local'): string | null {
  try {
    return getStore(store)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function safeSet(key: string, value: string, store: Store = 'local') {
  try {
    getStore(store)?.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function safeRemove(key: string, store: Store = 'local') {
  try {
    getStore(store)?.removeItem(key);
  } catch {
    /* ignore */
  }
}
