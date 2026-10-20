import { useSearchParams } from 'react-router-dom';
import ContactForm from '@/components/forms/ContactForm';
import type { LeadInterest } from '@/types';
import styles from './ContactSection.module.scss';

const VALID: LeadInterest[] = ['venta', 'compra', 'renta', 'inversion', 'otro'];

export default function ContactSection() {
  const [params] = useSearchParams();
  const raw = params.get('interes') as LeadInterest | null;
  const interest = raw && VALID.includes(raw) ? raw : '';

  return (
    <section id="contacto" className={styles.section}>
      <div className={`container ${styles.grid}`}>
        <div className={styles.text}>
          <h2>Nuestro equipo te contactará</h2>
          <p>Déjanos tus datos y uno de nuestros expertos se pondrá en contacto contigo a la brevedad.</p>
          <p>
            Todos nuestros asesores cuentan con experiencia multidisciplinaria y cada uno se ha especializado en
            diferentes áreas inmobiliarias.
          </p>
          <p>
            Ellos te brindarán una asesoría objetiva y bien informada, siempre anteponiendo los intereses de nuestros
            clientes sobre los nuestros.
          </p>
        </div>
        <ContactForm defaultInterest={interest} className={styles.form} />
      </div>
    </section>
  );
}
