import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { FAQS } from '@/utils/content';
import { cx } from '@/utils/format';
import type React from 'react';
import SectionArcs from '@/components/ui/SectionArcs';
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
    <section id="faq" className="section section--arcs">
      <SectionArcs edge="top" side="right" />
      <div className="container">
        <h2 className="section-title" data-reveal>
          Preguntas frecuentes
        </h2>
        <div className={styles.list}>
          {FAQS.map((f, i) => (
            <div key={f.q} className={cx(styles.item, open.has(i) && styles.open)} data-reveal style={{ '--reveal-delay': `${i * 80}ms` } as React.CSSProperties}>
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
