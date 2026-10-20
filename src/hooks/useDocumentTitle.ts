import { useEffect } from 'react';

/**
 * Título para páginas privadas o utilitarias (panel, login, ficha PDF).
 * También las marca como noindex para que no aparezcan en buscadores.
 * Las páginas públicas usan useSeo().
 */
export function useDocumentTitle(title: string | undefined) {
  useEffect(() => {
    if (!title) return;
    const prev = document.title;
    document.title = `${title} | Espacio Querido`;

    let robots = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const prevRobots = robots?.content ?? null;
    if (!robots) {
      robots = document.createElement('meta');
      robots.name = 'robots';
      document.head.appendChild(robots);
    }
    robots.content = 'noindex, nofollow';

    return () => {
      document.title = prev;
      if (robots) {
        if (prevRobots == null) robots.remove();
        else robots.content = prevRobots;
      }
    };
  }, [title]);
}
