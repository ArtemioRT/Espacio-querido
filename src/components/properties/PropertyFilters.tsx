import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { AMENITIES, PROPERTY_TYPE_LABELS } from '@/utils/constants';
import { cx, formatNumber, onlyDigits } from '@/utils/format';
import type { LocationTree, PropertySearchFilters } from '@/services/properties.service';
import styles from './PropertyFilters.module.scss';

interface Props {
  value: PropertySearchFilters;
  onChange: (patch: Partial<PropertySearchFilters>) => void;
  onClear: () => void;
  locations: Array<{ label: string; kind: string }>;
  tree: LocationTree;
}

const COUNT_OPTIONS = [1, 2, 3, 4];

/** Campo de texto con debounce que se resincroniza si el filtro cambia desde fuera */
function useDebouncedText(external: string, commit: (v: string) => void, delay = 500) {
  const [local, setLocal] = useState(external);
  const debounced = useDebounce(local, delay);
  const lastCommitted = useRef(external);

  useEffect(() => {
    if (debounced !== lastCommitted.current) {
      lastCommitted.current = debounced;
      commit(debounced);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  useEffect(() => {
    if (external !== lastCommitted.current) {
      lastCommitted.current = external;
      setLocal(external);
    }
  }, [external]);

  return [local, setLocal] as const;
}

function RangeField({
  label,
  unit,
  min,
  max,
  onChange,
  placeholders = ['Mínimo', 'Máximo'],
}: {
  label: string;
  unit?: string;
  min?: number;
  max?: number;
  onChange: (min?: number, max?: number) => void;
  placeholders?: [string, string];
}) {
  const [lo, setLo] = useDebouncedText(min ? String(min) : '', (v) => onChange(Number(v) || undefined, max));
  const [hi, setHi] = useDebouncedText(max ? String(max) : '', (v) => onChange(min, Number(v) || undefined));
  const invalid = !!(min && max && min > max);

  return (
    <div className={styles.group}>
      <span className={styles.label}>
        {label}
        {unit && <small> ({unit})</small>}
      </span>
      <div className={styles.range}>
        <input className={cx('input', invalid && 'is-invalid')} inputMode="numeric" placeholder={placeholders[0]} value={lo ? formatNumber(Number(lo)) : ''} onChange={(e) => setLo(onlyDigits(e.target.value))} aria-label={`${label} mínimo`} />
        <span>—</span>
        <input className={cx('input', invalid && 'is-invalid')} inputMode="numeric" placeholder={placeholders[1]} value={hi ? formatNumber(Number(hi)) : ''} onChange={(e) => setHi(onlyDigits(e.target.value))} aria-label={`${label} máximo`} />
      </div>
      {invalid && <span className="field__error">El mínimo es mayor que el máximo</span>}
    </div>
  );
}

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

export default function PropertyFilters({ value, onChange, onClear, locations, tree }: Props) {
  const [q, setQ] = useDebouncedText(value.q ?? '', (v) => onChange({ q: v || undefined }), 450);
  const [showAllAmenities, setShowAllAmenities] = useState(false);

  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'es');
  const states = Object.entries(tree)
    .map(([slug, n]) => ({ slug, name: n.name, total: n.total }))
    .sort(byName);
  const stateNode = value.state ? tree[value.state] : undefined;
  const cities = stateNode
    ? Object.entries(stateNode.cities)
        .map(([slug, n]) => ({ slug, name: n.name, total: n.total }))
        .sort(byName)
    : [];
  const neighborhoods = stateNode && value.city && stateNode.cities[value.city] ? [...stateNode.cities[value.city].neighborhoods].sort(byName) : [];
  const unslug = (s: string) => s.replace(/-/g, ' ');

  const amenities = value.amenities ?? [];
  const toggleAmenity = (a: string) =>
    onChange({ amenities: amenities.includes(a) ? amenities.filter((x) => x !== a) : [...amenities, a] });
  const visibleAmenities = showAllAmenities ? AMENITIES : AMENITIES.slice(0, 8);

  return (
    <div className={styles.filters}>
      {/* ---------- Ubicación ---------- */}
      <fieldset className={styles.fieldset}>
        <legend className={styles.label}>Ubicación</legend>

        <div className={styles.inputWrap}>
          <input className="input" list="f-locations" placeholder="Buscar por palabra clave…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Palabra clave" />
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

        <div className="field">
          <label htmlFor="f-state" className={styles.sublabel}>
            Estado
          </label>
          <select
            id="f-state"
            className="select"
            value={value.state ?? ''}
            onChange={(e) => onChange({ state: e.target.value || undefined, city: undefined, neighborhood: undefined })}
          >
            <option value="">Todos los estados</option>
            {states.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.name} ({s.total})
              </option>
            ))}
            {value.state && !stateNode && <option value={value.state}>{unslug(value.state)}</option>}
          </select>
        </div>

        <div className="field">
          <label htmlFor="f-city" className={styles.sublabel}>
            Municipio
          </label>
          <select
            id="f-city"
            className="select"
            value={value.city ?? ''}
            disabled={!value.state}
            onChange={(e) => onChange({ city: e.target.value || undefined, neighborhood: undefined })}
          >
            <option value="">{value.state ? 'Todos los municipios' : 'Elige un estado primero'}</option>
            {cities.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name} ({c.total})
              </option>
            ))}
            {value.city && !cities.some((c) => c.slug === value.city) && <option value={value.city}>{unslug(value.city)}</option>}
          </select>
        </div>

        <div className="field">
          <label htmlFor="f-col" className={styles.sublabel}>
            Colonia
          </label>
          <select
            id="f-col"
            className="select"
            value={value.neighborhood ?? ''}
            disabled={!value.city}
            onChange={(e) => onChange({ neighborhood: e.target.value || undefined })}
          >
            <option value="">{value.city ? 'Todas las colonias' : 'Elige un municipio primero'}</option>
            {neighborhoods.map((n) => (
              <option key={n.slug} value={n.slug}>
                {n.name} ({n.total})
              </option>
            ))}
            {value.neighborhood && !neighborhoods.some((n) => n.slug === value.neighborhood) && (
              <option value={value.neighborhood}>{unslug(value.neighborhood)}</option>
            )}
          </select>
        </div>
      </fieldset>

      {/* ---------- Operación y tipo ---------- */}
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

      {/* ---------- Precio y medidas ---------- */}
      <RangeField label="Precio" unit="MXN" min={value.minPrice} max={value.maxPrice} onChange={(a, b) => onChange({ minPrice: a, maxPrice: b })} />

      <CountChips label="Recámaras" value={value.bedrooms} onChange={(v) => onChange({ bedrooms: v })} />
      <CountChips label="Baños" value={value.bathrooms} onChange={(v) => onChange({ bathrooms: v })} />
      <CountChips label="Estacionamientos" value={value.parking} onChange={(v) => onChange({ parking: v })} />

      <RangeField label="Metros de construcción" unit="m²" min={value.minM2} max={value.maxM2} onChange={(a, b) => onChange({ minM2: a, maxM2: b })} />
      <RangeField label="Metros de terreno" unit="m²" min={value.minLand} max={value.maxLand} onChange={(a, b) => onChange({ minLand: a, maxLand: b })} />

      {/* ---------- Amenidades ---------- */}
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
