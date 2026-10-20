import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Download } from 'lucide-react';
import { getPropertyBySlug } from '@/services/properties.service';
import { getPublicAgent } from '@/services/agents.service';
import { propertyUrl } from '@/app/paths';
import { COMPANY, PROPERTY_TYPE_LABELS } from '@/utils/constants';
import { IMAGES } from '@/utils/content';
import { formatNumber, formatPrice } from '@/utils/format';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import type { Property, PublicAgent } from '@/types';
import styles from './PropertySheetPage.module.scss';

/** Ficha técnica imprimible. Se abre desde "Compartir → PDF" y lanza el diálogo de impresión (Guardar como PDF). */
export default function PropertySheetPage() {
  const { slug = '' } = useParams();
  const [p, setP] = useState<Property | null | undefined>(undefined);
  const [agent, setAgent] = useState<PublicAgent | null>(null);

  useDocumentTitle(p ? `Ficha ID ${p.code}` : 'Ficha técnica');

  useEffect(() => {
    getPropertyBySlug(slug)
      .then(async (prop) => {
        if (prop?.agent_id) setAgent(await getPublicAgent(prop.agent_id));
        setP(prop);
      })
      .catch(() => setP(null));
  }, [slug]);

  // Espera a que carguen las imágenes y abre el diálogo de impresión
  useEffect(() => {
    if (!p) return;
    const imgs = Array.from(document.querySelectorAll<HTMLImageElement>(`.${styles.sheet} img`));
    const pending = imgs.filter((i) => !i.complete).map((i) => new Promise((r) => ((i.onload = r), (i.onerror = r))));
    const timeout = new Promise((r) => setTimeout(r, 4000));
    Promise.race([Promise.all(pending), timeout]).then(() => setTimeout(() => window.print(), 300));
  }, [p]);

  if (p === undefined) {
    return (
      <div className="page-loader" style={{ minHeight: '100vh' }}>
        <div className="spinner" />
      </div>
    );
  }
  if (!p) return <p style={{ padding: 40, textAlign: 'center' }}>Propiedad no disponible.</p>;

  const photos = (p.images?.length ? p.images.map((i) => i.url) : [p.cover_image_url]).filter(Boolean) as string[];
  const facts = [
    ['Tipo', PROPERTY_TYPE_LABELS[p.property_type]],
    ['Operación', p.operation_type === 'sale' ? 'Venta' : 'Renta'],
    p.construction_m2 ? ['Construcción', `${formatNumber(p.construction_m2)} m²`] : null,
    p.land_m2 ? ['Terreno', `${formatNumber(p.land_m2)} m²`] : null,
    p.bedrooms ? ['Recámaras', p.bedrooms] : null,
    p.bathrooms ? ['Baños', `${p.bathrooms}${p.half_bathrooms ? ` + ${p.half_bathrooms} medio` : ''}`] : null,
    p.parking_spaces ? ['Estacionamientos', p.parking_spaces] : null,
    p.floors ? ['Plantas', p.floors] : null,
    p.year_built ? ['Año', p.year_built] : null,
    p.maintenance_fee ? ['Mantenimiento', formatPrice(p.maintenance_fee, p.currency)] : null,
  ].filter(Boolean) as Array<[string, string | number]>;

  const url = window.location.origin + propertyUrl(p.slug);

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <button className="btn btn--primary" onClick={() => window.print()}>
          <Download /> Guardar como PDF
        </button>
      </div>

      <article className={styles.sheet}>
        <header className={styles.header}>
          <img src={IMAGES.logo} alt={COMPANY.name} className={styles.logo} />
          <div className={styles.headRight}>
            <span>ID {p.code}</span>
            <small>{new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}</small>
          </div>
        </header>

        <h1>{p.title}</h1>
        <p className={styles.loc}>{[p.address, p.neighborhood, p.city, p.state].filter(Boolean).join(', ')}</p>
        <p className={styles.price}>
          {formatPrice(p.price, p.currency, p.operation_type)} {p.currency === 'MXN' && 'MXN'}
        </p>

        {photos[0] && <img src={photos[0]} alt={`Fotografía principal: ${p.title}`} className={styles.cover} />}
        {photos.length > 1 && (
          <div className={styles.thumbs}>
            {photos.slice(1, 5).map((src, i) => (
              <img key={src} src={src} alt={`${p.title} – foto ${i + 2}`} />
            ))}
          </div>
        )}

        <div className={styles.cols}>
          <div>
            <h2>Características</h2>
            <dl className={styles.facts}>
              {facts.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            {p.amenities.length > 0 && (
              <>
                <h2>Amenidades</h2>
                <p className={styles.amen}>{p.amenities.join(' · ')}</p>
              </>
            )}
          </div>
          <div>
            {p.description && (
              <>
                <h2>Descripción</h2>
                <div className={styles.desc}>
                  {p.description.split(/\n+/).slice(0, 8).map((t, i) => (
                    <p key={i}>{t}</p>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <footer className={styles.footer}>
          <div>
            <strong>{agent?.full_name || COMPANY.name}</strong>
            <span>{agent?.title || 'Asesoría inmobiliaria'}</span>
            <span>
              Tel. {agent?.phone || COMPANY.phone} · {COMPANY.email}
            </span>
          </div>
          <div className={styles.url}>
            <span>Ver en línea</span>
            <strong>{url}</strong>
          </div>
        </footer>
      </article>
    </div>
  );
}
