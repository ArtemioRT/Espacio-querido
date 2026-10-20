import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PATHS } from '@/app/paths';
import { IMAGES } from '@/utils/content';
import styles from './AuthLayout.module.scss';

interface Props {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export default function AuthLayout({ title, subtitle, children, footer }: Props) {
  return (
    <div className={styles.wrap}>
      <div className={styles.side} style={{ backgroundImage: `url(${IMAGES.authSide})` }}>
        <div className={styles.sideOverlay} />
        <div className={styles.sideText}>
          <img src={IMAGES.logoWhite} alt="Espacio Querido" />
          <p>Panel de administración: propiedades, leads y analítica de tu sitio en un solo lugar.</p>
        </div>
      </div>
      <div className={styles.panel}>
        <div className={styles.card}>
          <Link to={PATHS.home} className={styles.logo}>
            <img src={IMAGES.logo} alt="Espacio Querido" />
          </Link>
          <h1>{title}</h1>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          {children}
          {footer && <div className={styles.footer}>{footer}</div>}
        </div>
      </div>
    </div>
  );
}
