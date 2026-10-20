import { useState } from 'react';
import { TEAM } from '@/utils/content';
import styles from './Team.module.scss';

function Member({ name, photo }: { name: string; photo: string }) {
  const [failed, setFailed] = useState(false);
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('');
  return (
    <figure className={styles.member}>
      <div className={styles.photo}>
        {failed ? <span>{initials}</span> : <img src={photo} alt={name} loading="lazy" onError={() => setFailed(true)} />}
      </div>
      <figcaption>{name}</figcaption>
    </figure>
  );
}

export default function Team() {
  return (
    <section id="equipo" className="section">
      <div className="container">
        <h2 className="section-title">Nuestro equipo de expertos</h2>
        <div className={styles.grid}>
          {TEAM.map((m) => (
            <Member key={m.name} {...m} />
          ))}
        </div>
      </div>
    </section>
  );
}
