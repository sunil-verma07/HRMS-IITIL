import { useEffect } from 'react';

export function useKeyboardShortcut(keys: string[], callback: () => void): void {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const normalized = keys.map((key) => key.toLowerCase());
      const matchesMeta = normalized.includes('meta') ? event.metaKey : true;
      const matchesCtrl = normalized.includes('ctrl') ? event.ctrlKey : true;
      const matchesKey = normalized.includes(event.key.toLowerCase());

      if (matchesMeta && matchesCtrl && matchesKey) {
        event.preventDefault();
        callback();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [callback, keys]);
}
