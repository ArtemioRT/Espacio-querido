import { useState } from 'react';
import { TEAM } from '@/utils/content';
import type React from 'react';
import SectionArcs from '@/components/ui/SectionArcs';
import styles from './Team.module.scss';

function Member({ name, photo, index }: { name: string; photo: string; index: number }) {
  const [failed, setFailed] = useState(false);
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('');
  return (
    <figure className={styles.member} data-reveal style={{ '--reveal-delay': `${(index % 4) * 80}ms` } as React.CSSProperties}>
      <div className={styles.photo}>
        {failed ? <span>{initials}</span> : <img src={photo} alt={name} loading="lazy" onError={() => setFailed(true)} />}
      </div>
      <figcaption>{name}</figcaption>
    </figure>
  );
}

export default function Team() {
  return (
    <section id="equipo" className="section section--arcs">
      <SectionArcs edge="top" side="right" />
      <SectionArcs edge="bottom" side="left" />
      <div className="container">
        <h2 className="section-title" data-reveal>
          Nuestro equipo de expertos
        </h2>
        <div className={styles.grid}>
          {TEAM.map((m, i) => (
            <Member key={m.name} {...m} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
