import type React from 'react';
import { Link } from 'react-router-dom';
import { sectionUrl } from '@/app/paths';
import { SERVICES } from '@/utils/content';
import SectionArcs from '@/components/ui/SectionArcs';
import styles from './Services.module.scss';

export default function Services() {
  return (
    <section id="servicios" className="section section--arcs">
      <SectionArcs edge="top" side="right" />
      <div className="container">
        <h2 className="section-title" data-reveal>
          Servicios
        </h2>
        <div className={styles.grid}>
          {SERVICES.map((s, i) => (
            <article key={s.id} className={styles.card} data-reveal style={{ '--reveal-delay': `${i * 120}ms` } as React.CSSProperties}>
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
