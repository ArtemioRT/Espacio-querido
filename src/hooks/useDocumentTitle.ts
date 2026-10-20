import { useEffect } from 'react';

export function useDocumentTitle(title: string | undefined, description?: string | null) {
  useEffect(() => {
    if (!title) return;
    const prev = document.title;
    document.title = `${title} | Espacio Querido`;
    let meta: HTMLMetaElement | null = null;
    let prevDesc: string | null = null;
    if (description) {
      meta = document.querySelector('meta[name="description"]');
      prevDesc = meta?.content ?? null;
      if (meta) meta.content = description.slice(0, 160);
    }
    return () => {
      document.title = prev;
      if (meta && prevDesc != null) meta.content = prevDesc;
    };
  }, [title, description]);
}
