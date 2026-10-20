import { useState } from 'react';
import { BANKS } from '@/utils/content';
import styles from './Financing.module.scss';

function BankTile({ name, logo }: { name: string; logo: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={styles.tile} title={name}>
      {failed ? <span>{name}</span> : <img src={logo} alt={name} loading="lazy" onError={() => setFailed(true)} />}
    </div>
  );
}

export default function Financing() {
  return (
    <section id="financiamientos" className="section section--soft">
      <div className="container">
        <h2 className="section-title">Financiamientos</h2>
        <div className={styles.grid}>
          {BANKS.map((b) => (
            <BankTile key={b.name} {...b} />
          ))}
        </div>
      </div>
    </section>
  );
}
