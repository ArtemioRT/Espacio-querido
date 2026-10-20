import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cx } from '@/utils/format';
import styles from './Pagination.module.scss';

interface Props {
  page: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
}

export default function Pagination({ page, total, pageSize, onChange }: Props) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;

  const range: Array<number | '…'> = [];
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - page) <= 1) range.push(i);
    else if (range[range.length - 1] !== '…') range.push('…');
  }

  return (
    <nav className={styles.pagination} aria-label="Paginación">
      <button onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label="Anterior">
        <ChevronLeft />
      </button>
      {range.map((r, i) =>
        r === '…' ? (
          <span key={`e${i}`} className={styles.ellipsis}>
            …
          </span>
        ) : (
          <button key={r} className={cx(r === page && styles.active)} onClick={() => onChange(r)} aria-current={r === page ? 'page' : undefined}>
            {r}
          </button>
        ),
      )}
      <button onClick={() => onChange(page + 1)} disabled={page >= pages} aria-label="Siguiente">
        <ChevronRight />
      </button>
    </nav>
  );
}
