import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { FAQS } from '@/utils/content';
import { cx } from '@/utils/format';
import styles from './Faq.module.scss';

export default function Faq() {
  // Todas abiertas como en el diseño; el usuario puede colapsarlas
  const [open, setOpen] = useState<Set<number>>(() => new Set(FAQS.map((_, i) => i)));

  const toggle = (i: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });

  return (
    <section id="faq" className="section">
      <div className="container">
        <h2 className="section-title">Preguntas frecuentes</h2>
        <div className={styles.list}>
          {FAQS.map((f, i) => (
            <div key={f.q} className={cx(styles.item, open.has(i) && styles.open)}>
              <button className={styles.q} onClick={() => toggle(i)} aria-expanded={open.has(i)}>
                <span>{f.q}</span>
                <ChevronDown />
              </button>
              <div className={styles.a}>
                <p>{f.a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
