import { Link } from 'react-router-dom';
import { Facebook, Instagram, Linkedin, Mail, MapPin, Phone } from 'lucide-react';
import { PATHS, sectionUrl } from '@/app/paths';
import { COMPANY } from '@/utils/constants';
import { IMAGES } from '@/utils/content';
import styles from './Footer.module.scss';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.grid}`}>
        <div className={styles.brand}>
          <img src={IMAGES.logoIcon} alt="Espacio Querido" className={styles.icon} />
        </div>

        <div className={styles.contact}>
          <h4>Contacto</h4>
          <a href={COMPANY.phoneHref}>
            <Phone /> {COMPANY.phone}
          </a>
          <a href={`mailto:${COMPANY.email}`}>
            <Mail /> {COMPANY.email}
          </a>
          <p>
            <MapPin />
            <span>
              <strong>{COMPANY.addressLine1}</strong>
              <br />
              {COMPANY.addressLine2}
            </span>
          </p>
        </div>

        <div className={styles.links}>
          <Link to={PATHS.properties}>Propiedades</Link>
          <Link to={sectionUrl('servicios')}>Servicios</Link>
          <Link to={sectionUrl('faq')}>Preguntas frecuentes</Link>
          <Link to={PATHS.privacy}>Aviso de privacidad</Link>
        </div>

        <div className={styles.join}>
          <span>Join us</span>
          <div className={styles.social}>
            <a href={COMPANY.social.facebook} target="_blank" rel="noreferrer" aria-label="Facebook">
              <Facebook />
            </a>
            <a href={COMPANY.social.instagram} target="_blank" rel="noreferrer" aria-label="Instagram">
              <Instagram />
            </a>
            <a href={COMPANY.social.linkedin} target="_blank" rel="noreferrer" aria-label="LinkedIn">
              <Linkedin />
            </a>
          </div>
        </div>
      </div>
      <div className={`container ${styles.bottom}`}>
        <span>Copyright © {new Date().getFullYear()} Espacio Querido</span>
        <Link to={PATHS.admin.login} className={styles.admin}>
          Acceso asesores
        </Link>
      </div>
    </footer>
  );
}
