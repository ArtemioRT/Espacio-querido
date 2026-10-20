import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { PATHS, sectionUrl } from '@/app/paths';
import { IMAGES } from '@/utils/content';
import { PROPERTY_TYPE_LABELS } from '@/utils/constants';
import { cx } from '@/utils/format';
import type { OperationType } from '@/types';
import styles from './Hero.module.scss';

export default function Hero() {
  const navigate = useNavigate();
  const [operation, setOperation] = useState<OperationType>('sale');
  const [q, setQ] = useState('');
  const [type, setType] = useState('');

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams({ operation });
    if (q.trim()) params.set('q', q.trim());
    if (type) params.set('type', type);
    navigate(`${PATHS.properties}?${params.toString()}`);
  };

  return (
    <section className={styles.hero} style={{ backgroundImage: `url(${IMAGES.hero})` }}>
      <div className={styles.overlay} />
      <div className={cx('container', styles.content)}>
        <h1>Deja el proceso de elegir una casa en nuestras manos</h1>
        <div className={styles.ctas}>
          <Link to={sectionUrl('contacto')} className="btn btn--primary" data-track="cta_click" data-track-label="Hero · Agenda cita">
            ¡Agenda tu cita con un experto!
          </Link>
          <Link to={PATHS.properties} className="btn btn--light" data-track="cta_click" data-track-label="Hero · Catálogo">
            Conoce nuestro catálogo de propiedades
          </Link>
        </div>

        {/* Buscador rápido (nuevo) */}
        <form className={styles.search} onSubmit={onSubmit} role="search">
          <div className={styles.tabs} role="tablist">
            {(['sale', 'rent'] as OperationType[]).map((op) => (
              <button
                key={op}
                type="button"
                role="tab"
                aria-selected={operation === op}
                className={cx(styles.tab, operation === op && styles.tabActive)}
                onClick={() => setOperation(op)}
              >
                {op === 'sale' ? 'Comprar' : 'Rentar'}
              </button>
            ))}
          </div>
          <div className={styles.fields}>
            <input
              className="input"
              placeholder="Colonia, ciudad o zona"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Ubicación"
            />
            <select className="select" value={type} onChange={(e) => setType(e.target.value)} aria-label="Tipo de propiedad">
              <option value="">Todos los tipos</option>
              {Object.entries(PROPERTY_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <button className="btn btn--primary" type="submit">
              <Search /> Buscar
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
