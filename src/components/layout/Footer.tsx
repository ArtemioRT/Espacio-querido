import { Link } from 'react-router-dom';
import { PATHS } from '@/app/paths';
import { COMPANY } from '@/utils/constants';
import { IMAGES } from '@/utils/content';
import styles from './Footer.module.scss';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.grid}`}>
        <div className={styles.left}>
          <img src={IMAGES.logoIcon} alt="Espacio Querido" className={styles.monogram} />

          <div className={styles.contact}>
            <h4>Contacto</h4>
            <a href={COMPANY.phoneHref}>{COMPANY.phone}</a>
            <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
            <p className={styles.address}>
              <strong>{COMPANY.addressLine1}</strong>
              {COMPANY.addressLine2}
            </p>
          </div>
        </div>

        <div className={styles.right}>
          <Link to={PATHS.privacy} className={styles.underline}>
            Aviso de privacidad
          </Link>
          <span>Copyright © 2023 Espacio Querido</span>
          <a href={COMPANY.social.instagram} target="_blank" rel="noreferrer" className={styles.join}>
            JOIN US
          </a>
          <Link to={PATHS.admin.login} className={styles.staff}>
            Acceso asesores
          </Link>
        </div>
      </div>
    </footer>
  );
}
