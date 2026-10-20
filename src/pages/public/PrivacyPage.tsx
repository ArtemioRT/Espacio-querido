import { useState } from 'react';
import { COMPANY } from '@/utils/constants';
import { CONSENT_KEY } from '@/services/analytics.service';
import { safeGet, safeSet } from '@/utils/storage';
import { useSeo } from '@/hooks/useSeo';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import { breadcrumbLd, type Crumb } from '@/utils/seo';
import { PATHS } from '@/app/paths';
import { cx } from '@/utils/format';
import styles from './PrivacyPage.module.scss';

/*
 * Texto del aviso de privacidad. Las secciones 1 y 2 vienen del sitio actual; revisa las
 * demás contra el aviso oficial de la inmobiliaria y ajústalas aquí si hace falta.
 */
export default function PrivacyPage() {
  const crumbs: Crumb[] = [{ label: 'Inicio', to: PATHS.home }, { label: 'Aviso de privacidad' }];
  useSeo({
    title: 'Aviso de privacidad',
    description: 'Conoce cómo Espacio Querido recolecta, usa y protege tus datos personales, y cómo ejercer tus derechos ARCO.',
    jsonLd: [breadcrumbLd(crumbs)],
  });
  const [consent, setConsent] = useState(safeGet(CONSENT_KEY));

  const update = (v: 'accepted' | 'rejected') => {
    safeSet(CONSENT_KEY, v);
    setConsent(v);
  };

  return (
    <article className={styles.page}>
      <div className={styles.inner}>
        <Breadcrumbs items={crumbs} />
        <h1 data-reveal>Aviso de Privacidad</h1>
        <p className={styles.subtitle}>Política de Privacidad de Espacio Querido</p>

        <section>
          <h2>1. Introducción</h2>
          <p>
            Espacio Querido se compromete a proteger la privacidad de nuestros usuarios y clientes. Esta Política de
            Privacidad describe cómo recolectamos, utilizamos y protegemos la información personal que nos proporcionas
            cuando participas en nuestras campañas publicitarias en Facebook y otros medios digitales.
          </p>
        </section>

        <section>
          <h2>2. Recolección de Información Personal</h2>
          <p>
            Para participar en nuestras campañas publicitarias y procesos de selección, podemos recolectar la siguiente
            información personal:
          </p>
          <ul>
            <li>Nombre completo</li>
            <li>Correo electrónico</li>
            <li>Número de teléfono</li>
            <li>Información sobre la propiedad o el servicio de tu interés</li>
            <li>Datos de navegación en nuestro sitio (páginas visitadas, tiempo de permanencia y origen de la visita)</li>
          </ul>
        </section>

        <section>
          <h2>3. Uso de la Información</h2>
          <p>La información que recolectamos se utiliza para:</p>
          <ul>
            <li>Contactarte y brindarte asesoría inmobiliaria personalizada.</li>
            <li>Dar seguimiento a tus solicitudes de compra, venta, renta o inversión.</li>
            <li>Enviarte información sobre propiedades que coincidan con tu búsqueda.</li>
            <li>Mejorar nuestro sitio web y la calidad de nuestros servicios.</li>
          </ul>
        </section>

        <section>
          <h2>4. Protección de la Información</h2>
          <p>
            Implementamos medidas de seguridad técnicas y administrativas para proteger tu información personal contra
            accesos no autorizados, pérdida o alteración. Solo el personal autorizado de Espacio Querido tiene acceso a
            tus datos.
          </p>
        </section>

        <section>
          <h2>5. Compartir Información</h2>
          <p>
            No vendemos ni rentamos tu información personal. Únicamente podemos compartirla con proveedores que nos
            ayudan a operar nuestros servicios (por ejemplo, instituciones financieras o notarías, cuando tú lo
            solicites) o cuando la ley lo requiera.
          </p>
        </section>

        <section>
          <h2>6. Cookies</h2>
          <p>
            Usamos cookies propias para medir visitas, tiempo de permanencia y clics en el sitio con el fin de mejorar
            nuestro servicio. Puedes cambiar tu preferencia en cualquier momento:
          </p>
          <div className={styles.consent}>
            <span>
              Preferencia actual:{' '}
              <strong>{consent === 'rejected' ? 'cookies de analítica desactivadas' : 'cookies de analítica activas'}</strong>
            </span>
            <div>
              <button className={cx(styles.btn, consent === 'rejected' && styles.btnOn)} onClick={() => update('rejected')}>
                Desactivar
              </button>
              <button className={cx(styles.btn, consent !== 'rejected' && styles.btnOn)} onClick={() => update('accepted')}>
                Aceptar
              </button>
            </div>
          </div>
        </section>

        <section>
          <h2>7. Derechos ARCO</h2>
          <p>
            Tienes derecho a Acceder, Rectificar, Cancelar u Oponerte al tratamiento de tus datos personales. Para
            ejercerlos, envía tu solicitud a <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> indicando tu nombre
            completo y el derecho que deseas ejercer.
          </p>
        </section>

        <section>
          <h2>8. Cambios a esta Política</h2>
          <p>
            Espacio Querido puede actualizar esta Política de Privacidad en cualquier momento. Los cambios se publicarán
            en esta misma página.
          </p>
        </section>

        <section>
          <h2>9. Contacto</h2>
          <p>
            {COMPANY.addressLine1}, {COMPANY.addressLine2}
            <br />
            Tel. <a href={COMPANY.phoneHref}>{COMPANY.phone}</a> · <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
          </p>
        </section>
      </div>
    </article>
  );
}
