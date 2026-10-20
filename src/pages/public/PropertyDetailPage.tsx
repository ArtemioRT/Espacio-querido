import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Bath, BedDouble, Building, Calendar, Car, Check, Frame, Home, MessageCircle, Phone,
} from 'lucide-react';
import { PATHS, agentPropertiesUrl, propertyUrl } from '@/app/paths';
import PropertyGallery from '@/components/properties/PropertyGallery';
import PropertyCard from '@/components/properties/PropertyCard';
import ShareProperty from '@/components/properties/ShareProperty';
import AgentMessageForm from '@/components/properties/AgentMessageForm';
import Avatar from '@/components/ui/Avatar';
import { getPropertyBySlug, getSimilarProperties } from '@/services/properties.service';
import { getPublicAgent, toWhatsappNumber } from '@/services/agents.service';
import { trackEvent } from '@/services/analytics.service';
import { summarize, useSeo } from '@/hooks/useSeo';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import { breadcrumbLd, listingLd, type Crumb } from '@/utils/seo';
import { catalogPath, facetCrumbs, slugify, TYPE_PLURAL } from '@/utils/catalog';
import { COMPANY, PROPERTY_TYPE_LABELS } from '@/utils/constants';
import { IMAGES } from '@/utils/content';
import { formatNumber, formatPrice } from '@/utils/format';
import type { Property, PublicAgent } from '@/types';
import NotFoundPage from './NotFoundPage';
import styles from './PropertyDetailPage.module.scss';

export default function PropertyDetailPage() {
  const { slug = '' } = useParams();
  const [property, setProperty] = useState<Property | null>(null);
  const [agent, setAgent] = useState<PublicAgent | null>(null);
  const [similar, setSimilar] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  // ---------- SEO ----------
  const pp = property;
  // Inicio › Propiedades › Venta › Casas › Nuevo León › Monterrey › Cumbres › ID …
  const zone = pp
    ? {
        operation: pp.operation_type,
        type: pp.property_type,
        state: pp.state_slug || slugify(pp.state) || undefined,
        city: pp.city_slug || slugify(pp.city) || undefined,
        neighborhood: pp.neighborhood_slug || slugify(pp.neighborhood) || undefined,
      }
    : null;
  const crumbs: Crumb[] = zone
    ? [
        ...facetCrumbs(zone, { state: pp!.state ?? undefined, city: pp!.city ?? undefined, neighborhood: pp!.neighborhood ?? undefined }),
        { label: `ID ${pp!.code} · ${pp!.title}` },
      ]
    : [{ label: 'Inicio', to: PATHS.home }, { label: 'Propiedades', to: PATHS.properties }];
  const zoneUrl = zone ? catalogPath(zone) : PATHS.properties;

  const seoTitle = pp
    ? `${PROPERTY_TYPE_LABELS[pp.property_type]} en ${pp.operation_type === 'sale' ? 'venta' : 'renta'} en ${[pp.neighborhood, pp.city].filter(Boolean).join(', ') || pp.title} · ID ${pp.code}`
    : undefined;
  const seoDescription = pp
    ? `${formatPrice(pp.price, pp.currency, pp.operation_type)}${pp.bedrooms ? ` · ${pp.bedrooms} recámaras` : ''}${pp.bathrooms ? ` · ${pp.bathrooms} baños` : ''}${pp.construction_m2 ? ` · ${formatNumber(pp.construction_m2)} m² de construcción` : ''}${pp.land_m2 ? ` · ${formatNumber(pp.land_m2)} m² de terreno` : ''}. ${summarize(pp.description, 90)}`
    : undefined;

  useSeo({
    title: seoTitle,
    description: seoDescription,
    canonical: pp ? propertyUrl(pp.slug) : undefined,
    image: pp?.cover_image_url,
    type: 'article',
    jsonLd: pp ? [listingLd(pp, propertyUrl(pp.slug), agent), breadcrumbLd(crumbs)] : [],
  });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setAgent(null);
    getPropertyBySlug(slug)
      .then((p) => {
        if (cancelled) return;
        setProperty(p);
        if (p) {
          trackEvent('property_view', { propertyId: p.id, label: p.title });
          getSimilarProperties(p).then((s) => !cancelled && setSimilar(s));
          if (p.agent_id) getPublicAgent(p.agent_id).then((a) => !cancelled && setAgent(a));
        }
      })
      .catch(() => !cancelled && setProperty(null))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="container" style={{ padding: '32px 16px' }}>
        <div className="skeleton" style={{ aspectRatio: '16/7', width: '100%' }} />
        <div className="skeleton" style={{ height: 28, width: '50%', marginTop: 24 }} />
        <div className="skeleton" style={{ height: 18, width: '30%', marginTop: 12 }} />
      </div>
    );
  }

  if (!property) return <NotFoundPage message="Esta propiedad ya no está disponible." />;

  const p = property;
  const finished = p.status === 'finished';
  const images = (p.images?.length ? p.images.map((i) => i.url) : [p.cover_image_url]).filter(Boolean) as string[];
  const typeLabel = `${PROPERTY_TYPE_LABELS[p.property_type]} en ${p.operation_type === 'sale' ? 'venta' : 'renta'}`;
  const cityLine = [p.city, p.state].filter(Boolean).join(', ');

  // Contacto: asesor asignado o, si no hay, la inmobiliaria
  const contactName = agent?.full_name || COMPANY.name;
  const contactPhone = agent?.phone || COMPANY.phoneHref.replace('tel:', '');
  const waNumber = toWhatsappNumber(agent?.whatsapp || agent?.phone) || COMPANY.whatsapp;
  const waText = `¡Hola${agent?.full_name ? ` ${agent.full_name.split(' ')[0]}` : ''}! Me interesa la propiedad ID ${p.code} – ${p.title}: ${window.location.href}`;

  const stats = [
    p.floors ? { icon: Building, value: p.floors, label: p.floors === 1 ? 'Planta' : 'Plantas' } : null,
    p.land_m2 ? { icon: Frame, value: formatNumber(p.land_m2), label: 'm² terreno' } : null,
    p.construction_m2 ? { icon: Home, value: formatNumber(p.construction_m2), label: 'm² construcción' } : null,
    p.bedrooms ? { icon: BedDouble, value: p.bedrooms, label: p.bedrooms === 1 ? 'Recámara' : 'Recámaras' } : null,
    p.bathrooms ? { icon: Bath, value: p.half_bathrooms ? `${p.bathrooms}½` : p.bathrooms, label: 'Baños' } : null,
    p.parking_spaces ? { icon: Car, value: p.parking_spaces, label: 'Estacionamientos' } : null,
    p.year_built ? { icon: Calendar, value: p.year_built, label: 'Año' } : null,
  ].filter(Boolean) as Array<{ icon: typeof Home; value: string | number; label: string }>;

  const hasMap = p.latitude != null && p.longitude != null;
  const d = 0.008;
  const mapSrc = hasMap
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${p.longitude! - d},${p.latitude! - d},${p.longitude! + d},${p.latitude! + d}&layer=mapnik&marker=${p.latitude},${p.longitude}`
    : '';

  return (
    <div className={styles.page}>
      <div className="container">
        <Breadcrumbs items={crumbs} />

        {finished && (
          <div className={styles.finishedBanner}>
            Esta propiedad ya fue {p.operation_type === 'sale' ? 'vendida' : 'rentada'}. Contáctanos y te mostramos opciones similares.
          </div>
        )}

        <PropertyGallery
          images={images}
          captions={p.images?.length ? p.images.map((i) => i.caption) : []}
          title={`${typeLabel} en ${[p.neighborhood, p.city].filter(Boolean).join(', ')}`}
          propertyId={p.id}
        />

        {/* ---------- Encabezado: datos · asesor · contacto ---------- */}
        <header className={styles.head}>
          <div className={styles.info}>
            <span className={styles.code}>ID {p.code}</span>
            <h1 className={styles.location}>
              {p.neighborhood && <span>{p.neighborhood}</span>}
              {cityLine && <span>{cityLine}</span>}
              {!p.neighborhood && !cityLine && <span>{p.title}</span>}
            </h1>
            <p className={styles.type}>{typeLabel}</p>
            <strong className={styles.price}>
              {formatPrice(p.price, p.currency)}
              {p.currency === 'MXN' && ' MXN'}
              {p.operation_type === 'rent' && <small> /mes</small>}
            </strong>
            {p.maintenance_fee ? <span className={styles.fee}>+ {formatPrice(p.maintenance_fee, p.currency)} de mantenimiento</span> : null}
          </div>

          <div className={styles.photo}>
            {agent ? (
              <Avatar name={agent.full_name ? `${agent.full_name}, asesor(a) de esta propiedad` : null} src={agent.avatar_url} size={232} className={styles.avatar} />
            ) : (
              <span className={styles.companyLogo}>
                <img src={IMAGES.logo} alt={COMPANY.name} />
              </span>
            )}
          </div>

          <div className={styles.contact}>
            <span className={styles.contactLabel}>Contacta al asesor</span>
            <strong className={styles.agentName}>{contactName}</strong>
            {agent && agent.properties_count > 0 && (
              <Link to={agentPropertiesUrl(agent.id)} className={styles.agentLink}>
                Propiedades ({agent.properties_count})
              </Link>
            )}
            <a
              href={`https://wa.me/${waNumber}?text=${encodeURIComponent(waText)}`}
              target="_blank"
              rel="noreferrer"
              className={styles.waBtn}
              data-track-property={p.id}
              data-track-label={`WhatsApp asesor · ${contactName}`}
            >
              <MessageCircle /> WhatsApp
            </a>
            <a href={`tel:${contactPhone}`} className={styles.callBtn} data-track-property={p.id} data-track-label={`Llamada asesor · ${contactName}`}>
              <Phone /> Llamada
            </a>
          </div>
        </header>
      </div>

      {/* ---------- Barra de datos ---------- */}
      {stats.length > 0 && (
        <div className={styles.statsBar}>
          <ul className="container">
            {stats.map((s) => (
              <li key={s.label}>
                <s.icon />
                <strong>{s.value}</strong>
                <span>{s.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ---------- Contenido ---------- */}
      <div className={`container ${styles.content}`}>
        <div className={styles.main}>
          <h2 className={styles.titleLine}>{p.title}</h2>

          {p.description && (
            <section className={styles.block}>
              <h3>Descripción</h3>
              <div className={styles.description}>
                {p.description.split(/\n+/).map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
            </section>
          )}

          {p.amenities.length > 0 && (
            <section className={styles.block}>
              <h3>Amenidades</h3>
              <ul className={styles.amenities}>
                {p.amenities.map((a) => (
                  <li key={a}>
                    <Check /> {a}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {p.video_url && (
            <section className={styles.block}>
              <h3>Video</h3>
              <a href={p.video_url} target="_blank" rel="noreferrer" className="btn btn--outline btn--sm">
                Ver recorrido en video
              </a>
            </section>
          )}

          {hasMap && (
            <section className={styles.block}>
              <h3>Ubicación</h3>
              <div className={styles.map}>
                <iframe title="Mapa de la propiedad" src={mapSrc} loading="lazy" />
              </div>
              <a
                className={styles.mapLink}
                href={`https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}`}
                target="_blank"
                rel="noreferrer"
                data-track="click"
                data-track-label="Abrir en Google Maps"
                data-track-property={p.id}
              >
                Abrir en Google Maps
              </a>
            </section>
          )}
        </div>

        <aside className={styles.aside}>
          <ShareProperty propertyId={p.id} slug={p.slug} title={`${typeLabel} · ${p.neighborhood ?? p.city ?? ''}`} />
          <a href="#mensaje" className={`btn btn--primary btn--block ${styles.cta}`} data-track="cta_click" data-track-label="Detalle · Ir a formulario">
            Envía un mensaje al asesor
          </a>
        </aside>
      </div>

      <AgentMessageForm propertyId={p.id} propertyLabel={`ID ${p.code} (${p.title})`} agentName={agent?.full_name} />

      {similar.length > 0 && (
        <section className={`container ${styles.similar}`}>
          <h2 className="section-title">Propiedades similares</h2>
          <p className={styles.zoneLink}>
            <Link to={zoneUrl}>
              Ver más {TYPE_PLURAL[p.property_type].toLowerCase()} en {p.operation_type === 'sale' ? 'venta' : 'renta'}
              {p.neighborhood ? ` en ${p.neighborhood}` : p.city ? ` en ${p.city}` : ''} →
            </Link>
          </p>
          <div className={styles.similarGrid}>
            {similar.map((s) => (
              <PropertyCard key={s.id} property={s} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
