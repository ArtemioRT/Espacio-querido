import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { PATHS } from '@/app/paths';
import PropertyCard, { PropertyCardSkeleton } from '@/components/properties/PropertyCard';
import { getFeaturedProperties } from '@/services/properties.service';
import type { Property } from '@/types';
import styles from './FeaturedProperties.module.scss';

export default function FeaturedProperties() {
  const [items, setItems] = useState<Property[] | null>(null);

  useEffect(() => {
    getFeaturedProperties(6)
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  if (items && items.length === 0) return null;

  return (
    <section id="propiedades" className="section section--soft">
      <div className="container">
        <h2 className="section-title">Propiedades destacadas</h2>
        <div className={styles.grid}>
          {items
            ? items.map((p) => <PropertyCard key={p.id} property={p} />)
            : Array.from({ length: 3 }).map((_, i) => <PropertyCardSkeleton key={i} />)}
        </div>
        <div className={styles.more}>
          <Link to={PATHS.properties} className="btn btn--outline" data-track="cta_click" data-track-label="Home · Ver todas las propiedades">
            Ver todas las propiedades <ArrowRight />
          </Link>
        </div>
      </div>
    </section>
  );
}
