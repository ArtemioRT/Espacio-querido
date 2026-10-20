import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** Hace scroll a #seccion al navegar (p. ej. /#servicios) o arriba al cambiar de ruta. */
export function useScrollToHash() {
  const { pathname, hash, search } = useLocation();
  useEffect(() => {
    if (hash) {
      const id = hash.slice(1);
      // espera a que la sección se pinte
      const t = setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 60);
      return () => clearTimeout(t);
    }
    window.scrollTo({ top: 0 });
  }, [pathname, hash, search]);
}
