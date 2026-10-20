import type React from 'react';
import { WHY_US } from '@/utils/content';
import SectionArcs from '@/components/ui/SectionArcs';
import styles from './WhyUs.module.scss';

export default function WhyUs() {
  return (
    <section id="nosotros" className={styles.section}>
      <SectionArcs edge="top" side="right" tone="light" />
      <SectionArcs edge="bottom" side="left" tone="light" />
      <div className={`container ${styles.inner}`}>
        <h2 data-reveal>¿Por qué trabajar con nosotros?</h2>
        {WHY_US.map((p, i) => (
          <p key={p.slice(0, 24)} data-reveal style={{ '--reveal-delay': `${80 + i * 70}ms` } as React.CSSProperties}>
            {p}
          </p>
        ))}
      </div>
    </section>
  );
}
