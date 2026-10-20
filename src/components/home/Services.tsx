import { Link } from 'react-router-dom';
import { sectionUrl } from '@/app/paths';
import { SERVICES } from '@/utils/content';
import styles from './Services.module.scss';

export default function Services() {
  return (
    <section id="servicios" className="section">
      <div className="container">
        <h2 className="section-title">Servicios</h2>
        <div className={styles.grid}>
          {SERVICES.map((s) => (
            <article key={s.id} className={styles.card}>
              <div className={styles.media}>
                <img src={s.image} alt={s.title} loading="lazy" />
              </div>
              <div className={styles.body}>
                <h3>{s.title}</h3>
                {s.lines.map((l) => (
                  <p key={l}>{l}</p>
                ))}
                <Link
                  to={sectionUrl('contacto', `interes=${s.id}`)}
                  className="btn btn--primary btn--sm"
                  data-track="cta_click"
                  data-track-label={`Servicios · ${s.title}`}
                >
                  {s.cta}
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
