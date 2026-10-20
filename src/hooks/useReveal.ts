import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Animación de entrada al hacer scroll: todo elemento con `data-reveal` aparece
 * (fade + desplazamiento) cuando entra en pantalla. Usa `style={{ '--reveal-delay': '120ms' }}`
 * para escalonar. Respeta "reducir movimiento" del sistema (ver global.scss).
 */
export function useReveal() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-visible'));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('is-visible');
            io.unobserve(e.target);
          }
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    );

    const observeAll = (root: ParentNode) =>
      root.querySelectorAll<HTMLElement>('[data-reveal]:not(.is-visible)').forEach((el) => io.observe(el));

    observeAll(document);

    // Contenido que se carga después (propiedades, etc.)
    const mo = new MutationObserver((muts) => {
      muts.forEach((m) =>
        m.addedNodes.forEach((n) => {
          if (n instanceof HTMLElement) {
            if (n.hasAttribute('data-reveal')) io.observe(n);
            observeAll(n);
          }
        }),
      );
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, [pathname]);
}
