import { useState } from 'react';
import { BANKS } from '@/utils/content';
import type React from 'react';
import SectionArcs from '@/components/ui/SectionArcs';
import styles from './Financing.module.scss';

function BankTile({ name, logo, index }: { name: string; logo: string; index: number }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={styles.tile} title={name} data-reveal="zoom" style={{ '--reveal-delay': `${(index % 4) * 90}ms` } as React.CSSProperties}>
      {failed ? <span>{name}</span> : <img src={logo} alt={`Logo de ${name}, opción de crédito hipotecario`} loading="lazy" onError={() => setFailed(true)} />}
    </div>
  );
}

export default function Financing() {
  return (
    <section id="financiamientos" className="section section--soft section--arcs">
      <SectionArcs edge="top" side="left" />
      <div className="container">
        <h2 className="section-title" data-reveal>
          Financiamientos
        </h2>
        <div className={styles.grid}>
          {BANKS.map((b, i) => (
            <BankTile key={b.name} {...b} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
