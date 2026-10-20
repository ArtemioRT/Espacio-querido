import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { AMENITIES, PROPERTY_TYPE_LABELS } from '@/utils/constants';
import { cx, onlyDigits } from '@/utils/format';
import type { PropertySearchFilters } from '@/services/properties.service';
import styles from './PropertyFilters.module.scss';

interface Props {
  value: PropertySearchFilters;
  onChange: (patch: Partial<PropertySearchFilters>) => void;
  onClear: () => void;
  locations: Array<{ label: string; kind: string }>;
}

const COUNT_OPTIONS = [1, 2, 3, 4];

function CountChips({ label, value, onChange }: { label: string; value?: number; onChange: (v?: number) => void }) {
  return (
    <div className={styles.group}>
      <span className={styles.label}>{label}</span>
      <div className={styles.chips}>
        <button type="button" className={cx(styles.chip, !value && styles.chipActive)} onClick={() => onChange(undefined)}>
          Todas
        </button>
        {COUNT_OPTIONS.map((n) => (
          <button key={n} type="button" className={cx(styles.chip, value === n && styles.chipActive)} onClick={() => onChange(n)}>
            {n}+
          </button>
        ))}
      </div>
    </div>
  );
}

export default function PropertyFilters({ value, onChange, onClear, locations }: Props) {
  const [q, setQ] = useState(value.q ?? '');
  const [minPrice, setMinPrice] = useState(value.minPrice ? String(value.minPrice) : '');
  const [maxPrice, setMaxPrice] = useState(value.maxPrice ? String(value.maxPrice) : '');
  const [minM2, setMinM2] = useState(value.minM2 ? String(value.minM2) : '');
  const [showAllAmenities, setShowAllAmenities] = useState(false);

  const dq = useDebounce(q, 450);
  const dMin = useDebounce(minPrice, 600);
  const dMax = useDebounce(maxPrice, 600);
  const dM2 = useDebounce(minM2, 600);

  // Sincroniza inputs de texto (con debounce) hacia la URL
  useEffect(() => {
    if ((value.q ?? '') !== dq) onChange({ q: dq || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dq]);
  useEffect(() => {
    const n = Number(dMin) || undefined;
    if (n !== value.minPrice) onChange({ minPrice: n });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dMin]);
  useEffect(() => {
    const n = Number(dMax) || undefined;
    if (n !== value.maxPrice) onChange({ maxPrice: n });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dMax]);
  useEffect(() => {
    const n = Number(dM2) || undefined;
    if (n !== value.minM2) onChange({ minM2: n });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dM2]);

  // Si la URL cambia desde fuera (p. ej. "Limpiar filtros"), resetea los inputs locales
  useEffect(() => {
    if ((value.q ?? '') !== dq) setQ(value.q ?? '');
    if ((value.minPrice ?? undefined) !== (Number(dMin) || undefined)) setMinPrice(value.minPrice ? String(value.minPrice) : '');
    if ((value.maxPrice ?? undefined) !== (Number(dMax) || undefined)) setMaxPrice(value.maxPrice ? String(value.maxPrice) : '');
    if ((value.minM2 ?? undefined) !== (Number(dM2) || undefined)) setMinM2(value.minM2 ? String(value.minM2) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.q, value.minPrice, value.maxPrice, value.minM2]);

  const amenities = value.amenities ?? [];
  const toggleAmenity = (a: string) =>
    onChange({ amenities: amenities.includes(a) ? amenities.filter((x) => x !== a) : [...amenities, a] });

  const visibleAmenities = showAllAmenities ? AMENITIES : AMENITIES.slice(0, 8);

  return (
    <div className={styles.filters}>
      <div className={styles.group}>
        <label className={styles.label} htmlFor="f-q">
          Ubicación o palabra clave
        </label>
        <div className={styles.inputWrap}>
          <input id="f-q" className="input" list="f-locations" placeholder="Ej. San Pedro, Cumbres…" value={q} onChange={(e) => setQ(e.target.value)} />
          {q && (
            <button type="button" className={styles.clearInput} onClick={() => setQ('')} aria-label="Limpiar">
              <X />
            </button>
          )}
        </div>
        <datalist id="f-locations">
          {locations.map((l) => (
            <option key={`${l.kind}-${l.label}`} value={l.label}>
              {l.kind}
            </option>
          ))}
        </datalist>
      </div>

      <div className={styles.group}>
        <span className={styles.label}>Operación</span>
        <div className={styles.segment}>
          {[
            ['', 'Todas'],
            ['sale', 'Venta'],
            ['rent', 'Renta'],
          ].map(([k, v]) => (
            <button
              key={k}
              type="button"
              className={cx(styles.segmentBtn, (value.operation ?? '') === k && styles.segmentActive)}
              onClick={() => onChange({ operation: (k || undefined) as PropertySearchFilters['operation'] })}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.group}>
        <label className={styles.label} htmlFor="f-type">
          Tipo de propiedad
        </label>
        <select id="f-type" className="select" value={value.type ?? ''} onChange={(e) => onChange({ type: (e.target.value || undefined) as PropertySearchFilters['type'] })}>
          <option value="">Todos</option>
          {Object.entries(PROPERTY_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.group}>
        <span className={styles.label}>Precio (MXN)</span>
        <div className={styles.range}>
          <input className="input" inputMode="numeric" placeholder="Mínimo" value={minPrice} onChange={(e) => setMinPrice(onlyDigits(e.target.value))} aria-label="Precio mínimo" />
          <span>—</span>
          <input className="input" inputMode="numeric" placeholder="Máximo" value={maxPrice} onChange={(e) => setMaxPrice(onlyDigits(e.target.value))} aria-label="Precio máximo" />
        </div>
      </div>

      <CountChips label="Recámaras" value={value.bedrooms} onChange={(v) => onChange({ bedrooms: v })} />
      <CountChips label="Baños" value={value.bathrooms} onChange={(v) => onChange({ bathrooms: v })} />
      <CountChips label="Estacionamientos" value={value.parking} onChange={(v) => onChange({ parking: v })} />

      <div className={styles.group}>
        <label className={styles.label} htmlFor="f-m2">
          Construcción mínima (m²)
        </label>
        <input id="f-m2" className="input" inputMode="numeric" placeholder="Ej. 150" value={minM2} onChange={(e) => setMinM2(onlyDigits(e.target.value))} />
      </div>

      <div className={styles.group}>
        <span className={styles.label}>Amenidades</span>
        <div className={styles.amenities}>
          {visibleAmenities.map((a) => (
            <label key={a} className="checkbox">
              <input type="checkbox" checked={amenities.includes(a)} onChange={() => toggleAmenity(a)} />
              {a}
            </label>
          ))}
        </div>
        <button type="button" className={styles.more} onClick={() => setShowAllAmenities((v) => !v)}>
          {showAllAmenities ? 'Ver menos' : `Ver todas (${AMENITIES.length})`}
        </button>
      </div>

      <button type="button" className="btn btn--ghost btn--block" onClick={onClear}>
        Limpiar filtros
      </button>
    </div>
  );
}
