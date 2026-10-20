import { WHY_US } from '@/utils/content';
import styles from './WhyUs.module.scss';

export default function WhyUs() {
  return (
    <section id="nosotros" className={styles.section}>
      <div className={`container ${styles.inner}`}>
        <h2>¿Por qué trabajar con nosotros?</h2>
        {WHY_US.map((p) => (
          <p key={p.slice(0, 24)}>{p}</p>
        ))}
      </div>
    </section>
  );
}
