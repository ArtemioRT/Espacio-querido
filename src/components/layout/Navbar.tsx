import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { PATHS, sectionUrl } from '@/app/paths';
import { IMAGES } from '@/utils/content';
import { useLockBody } from '@/hooks/useLockBody';
import { cx } from '@/utils/format';
import styles from './Navbar.module.scss';

const LINKS = [
  { label: 'Nosotros', to: sectionUrl('nosotros') },
  { label: 'Servicios', to: sectionUrl('servicios') },
  { label: 'Propiedades', to: PATHS.properties, route: true },
  { label: 'Financiamientos', to: sectionUrl('financiamientos') },
  { label: 'FAQ', to: sectionUrl('faq') },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useLockBody(open);

  useEffect(() => setOpen(false), [location.pathname, location.hash]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={cx(styles.header, scrolled && styles.scrolled)}>
      <div className={cx('container', styles.inner)}>
        <Link to={PATHS.home} className={styles.logo} aria-label="Espacio Querido, inicio">
          <img src={IMAGES.logo} alt="Espacio Querido" />
        </Link>

        <nav className={cx(styles.nav, open && styles.open)} aria-label="Principal">
          <ul>
            {LINKS.map((l) => (
              <li key={l.label}>
                {l.route ? (
                  <NavLink to={l.to} className={({ isActive }) => cx(styles.link, isActive && styles.active)}>
                    {l.label}
                  </NavLink>
                ) : (
                  <Link to={l.to} className={styles.link}>
                    {l.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
          <Link to={sectionUrl('contacto')} className={cx('btn btn--outline btn--sm', styles.cta)} data-track="cta_click" data-track-label="Navbar · Contáctanos">
            ¡Contáctanos!
          </Link>
        </nav>

        <button
          className={styles.burger}
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={open}
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>
      {open && <div className={styles.backdrop} onClick={() => setOpen(false)} />}
    </header>
  );
}
