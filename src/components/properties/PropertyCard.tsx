import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bath, BedDouble, Car, MapPin, Ruler } from 'lucide-react';
import { propertyUrl } from '@/app/paths';
import { OPERATION_LABELS, PROPERTY_TYPE_LABELS } from '@/utils/constants';
import { formatNumber, formatPrice, locationLabel } from '@/utils/format';
import { IMAGES } from '@/utils/content';
import type { Property } from '@/types';
import styles from './PropertyCard.module.scss';

export default function PropertyCard({ property: p }: { property: Property }) {
  const [imgError, setImgError] = useState(false);
  const finished = p.status === 'finished';
  const area = p.construction_m2 ?? p.land_m2;

  return (
    <Link to={propertyUrl(p.slug)} className={styles.card}>
      <div className={styles.media}>
        <img
          src={!imgError && p.cover_image_url ? p.cover_image_url : IMAGES.placeholder}
          alt={p.title}
          loading="lazy"
          onError={() => setImgError(true)}
        />
        <div className={styles.tags}>
          <span className={styles.op}>{OPERATION_LABELS[p.operation_type]}</span>
          {p.featured && !finished && <span className={styles.featured}>Destacada</span>}
        </div>
        {finished && <span className={styles.sold}>{p.operation_type === 'sale' ? 'Vendida' : 'Rentada'}</span>}
      </div>
      <div className={styles.body}>
        <span className={styles.type}>{PROPERTY_TYPE_LABELS[p.property_type]}</span>
        <strong className={styles.price}>{formatPrice(p.price, p.currency, p.operation_type)}</strong>
        <h3 className={styles.title}>{p.title}</h3>
        {locationLabel(p) && (
          <p className={styles.location}>
            <MapPin /> {locationLabel(p)}
          </p>
        )}
        <ul className={styles.features}>
          {p.bedrooms > 0 && (
            <li title="Recámaras">
              <BedDouble /> {p.bedrooms}
            </li>
          )}
          {p.bathrooms > 0 && (
            <li title="Baños">
              <Bath /> {p.bathrooms}
              {p.half_bathrooms ? ' ½' : ''}
            </li>
          )}
          {p.parking_spaces > 0 && (
            <li title="Estacionamientos">
              <Car /> {p.parking_spaces}
            </li>
          )}
          {area ? (
            <li title={p.construction_m2 ? 'Construcción' : 'Terreno'}>
              <Ruler /> {formatNumber(area)} m²
            </li>
          ) : null}
        </ul>
      </div>
    </Link>
  );
}

export function PropertyCardSkeleton() {
  return (
    <div className={styles.card} aria-hidden="true">
      <div className={`${styles.media} skeleton`} />
      <div className={styles.body}>
        <div className="skeleton" style={{ height: 12, width: '40%' }} />
        <div className="skeleton" style={{ height: 20, width: '60%', marginTop: 10 }} />
        <div className="skeleton" style={{ height: 14, width: '90%', marginTop: 10 }} />
        <div className="skeleton" style={{ height: 14, width: '70%', marginTop: 8 }} />
      </div>
    </div>
  );
}
