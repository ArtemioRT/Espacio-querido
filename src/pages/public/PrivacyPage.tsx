import { COMPANY } from '@/utils/constants';
import { CONSENT_KEY } from '@/services/analytics.service';
import { safeGet, safeSet } from '@/utils/storage';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useState } from 'react';

// Texto base: reemplázalo por el aviso de privacidad oficial de la inmobiliaria.
export default function PrivacyPage() {
  useDocumentTitle('Aviso de privacidad');
  const [consent, setConsent] = useState(safeGet(CONSENT_KEY));

  const update = (v: 'accepted' | 'rejected') => {
    safeSet(CONSENT_KEY, v);
    setConsent(v);
  };

  return (
    <div className="container section" style={{ maxWidth: 820 }}>
      <h1 className="section-title" style={{ textAlign: 'left' }}>
        Aviso de privacidad
      </h1>
      <p>
        {COMPANY.name}, con domicilio en {COMPANY.addressLine1}, {COMPANY.addressLine2}, es responsable del uso y
        protección de sus datos personales conforme a la Ley Federal de Protección de Datos Personales en Posesión de
        los Particulares.
      </p>
      <h3>Datos que recabamos</h3>
      <p>Nombre, teléfono, correo electrónico y la información que nos compartas sobre la propiedad o servicio de tu interés.</p>
      <h3>Finalidades</h3>
      <p>
        Contactarte para brindarte asesoría inmobiliaria, dar seguimiento a tu solicitud y enviarte información sobre
        propiedades que coincidan con tu búsqueda.
      </p>
      <h3>Cookies y analítica</h3>
      <p>
        Usamos cookies propias para medir visitas, tiempo de permanencia y clics en el sitio con el fin de mejorar
        nuestro servicio. No vendemos esta información a terceros.
      </p>
      <div className="card" style={{ padding: 18, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', margin: '8px 0 24px' }}>
        <span style={{ flex: 1, minWidth: 200, fontSize: 14 }}>
          Preferencia actual: <strong>{consent === 'rejected' ? 'Cookies de analítica desactivadas' : 'Cookies de analítica activas'}</strong>
        </span>
        <button className="btn btn--ghost btn--sm" onClick={() => update('rejected')}>
          Desactivar
        </button>
        <button className="btn btn--primary btn--sm" onClick={() => update('accepted')}>
          Aceptar
        </button>
      </div>
      <h3>Derechos ARCO</h3>
      <p>
        Puedes solicitar el acceso, rectificación, cancelación u oposición al tratamiento de tus datos escribiendo a{' '}
        <a href={`mailto:${COMPANY.email}`} style={{ color: '#9b1b3a' }}>
          {COMPANY.email}
        </a>
        .
      </p>
    </div>
  );
}
