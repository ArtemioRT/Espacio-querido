import { useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { PATHS } from '@/app/paths';
import { CONSENT_KEY } from '@/services/analytics.service';
import { safeGet, safeSet } from '@/utils/storage';
import styles from './CookieBanner.module.scss';

export default function CookieBanner() {
  const [visible, setVisible] = useState(() => !safeGet(CONSENT_KEY));

  if (!visible) return null;

  const decide = (value: 'accepted' | 'rejected') => {
    safeSet(CONSENT_KEY, value);
    setVisible(false);
  };

  return (
    <div className={styles.banner} role="dialog" aria-label="Aviso de cookies">
      <p>
        Usamos cookies en nuestra página web para ver cómo interactúas con ella. Al aceptarlas, estás de acuerdo con
        nuestro uso de dichas cookies. <Link to={PATHS.privacy}>Política de privacidad</Link>
      </p>
      <div className={styles.actions}>
        <Link to={PATHS.privacy} className={styles.options}>
          Opciones
        </Link>
        <button className="btn btn--light btn--sm" onClick={() => decide('rejected')}>
          Rechazar todas
        </button>
        <button className={`btn btn--sm ${styles.accept}`} onClick={() => decide('accepted')}>
          Aceptar
        </button>
        <button className={styles.close} onClick={() => setVisible(false)} aria-label="Cerrar">
          <X />
        </button>
      </div>
    </div>
  );
}
