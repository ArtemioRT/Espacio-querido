import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cx } from '@/utils/format';
import type { Crumb } from '@/utils/seo';
import styles from './Breadcrumbs.module.scss';

/** Ruta de navegación visible. El JSON-LD BreadcrumbList lo agrega cada página con useSeo. */
export default function Breadcrumbs({ items, light }: { items: Crumb[]; light?: boolean }) {
  return (
    <nav aria-label="Ruta de navegación" className={cx(styles.crumbs, light && styles.light)}>
      <ol>
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${c.label}-${i}`}>
              {c.to && !last ? <Link to={c.to}>{c.label}</Link> : <span aria-current={last ? 'page' : undefined}>{c.label}</span>}
              {!last && <ChevronRight aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
