import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, MapPin, Save } from 'lucide-react';
import { PageHeader, Panel } from '@/components/admin/AdminUI';
import ImageManager from '@/components/admin/ImageManager';
import Avatar from '@/components/ui/Avatar';
import { useAuth } from '@/context/AuthContext';
import { listAssignableAgents } from '@/services/agents.service';
import {
  createProperty, getPropertyById, syncPropertyImages, updateProperty, type EditableImage,
} from '@/services/properties.service';
import { useToast } from '@/context/ToastContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { PATHS, editPropertyUrl, propertyUrl } from '@/app/paths';
import { AMENITIES, MX_STATES, PROPERTY_TYPE_LABELS, STATUS_LABELS } from '@/utils/constants';
import { cx, formatPrice } from '@/utils/format';
import type { AgentRef, Currency, OperationType, Property, PropertyInput, PropertyStatus, PropertyType } from '@/types';
import styles from './PropertyEditorPage.module.scss';

type FormState = {
  title: string;
  description: string;
  status: PropertyStatus;
  operation_type: OperationType;
  property_type: PropertyType;
  price: string;
  currency: Currency;
  maintenance_fee: string;
  bedrooms: string;
  bathrooms: string;
  half_bathrooms: string;
  parking_spaces: string;
  construction_m2: string;
  land_m2: string;
  floors: string;
  year_built: string;
  state: string;
  city: string;
  neighborhood: string;
  address: string;
  postal_code: string;
  latitude: string;
  longitude: string;
  amenities: string[];
  video_url: string;
  featured: boolean;
  agent_id: string;
};

const EMPTY: FormState = {
  title: '',
  description: '',
  status: 'draft',
  operation_type: 'sale',
  property_type: 'casa',
  price: '',
  currency: 'MXN',
  maintenance_fee: '',
  bedrooms: '0',
  bathrooms: '0',
  half_bathrooms: '0',
  parking_spaces: '0',
  construction_m2: '',
  land_m2: '',
  floors: '',
  year_built: '',
  state: 'Nuevo León',
  city: 'Monterrey',
  neighborhood: '',
  address: '',
  postal_code: '',
  latitude: '',
  longitude: '',
  amenities: [],
  video_url: '',
  featured: false,
  agent_id: '',
};

const str = (v: number | null | undefined) => (v == null ? '' : String(v));
const toNum = (v: string) => (v.trim() === '' ? null : Number(v));
const toInt = (v: string) => (v.trim() === '' ? 0 : Math.max(0, parseInt(v, 10) || 0));

function fromProperty(p: Property): FormState {
  return {
    title: p.title,
    description: p.description ?? '',
    status: p.status,
    operation_type: p.operation_type,
    property_type: p.property_type,
    price: str(p.price),
    currency: p.currency,
    maintenance_fee: str(p.maintenance_fee),
    bedrooms: str(p.bedrooms),
    bathrooms: str(p.bathrooms),
    half_bathrooms: str(p.half_bathrooms),
    parking_spaces: str(p.parking_spaces),
    construction_m2: str(p.construction_m2),
    land_m2: str(p.land_m2),
    floors: str(p.floors),
    year_built: str(p.year_built),
    state: p.state ?? '',
    city: p.city ?? '',
    neighborhood: p.neighborhood ?? '',
    address: p.address ?? '',
    postal_code: p.postal_code ?? '',
    latitude: str(p.latitude),
    longitude: str(p.longitude),
    amenities: p.amenities ?? [],
    video_url: p.video_url ?? '',
    featured: p.featured,
    agent_id: p.agent_id ?? '',
  };
}

export default function PropertyEditorPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const toast = useToast();
  const { isAdmin, profile } = useAuth();
  useDocumentTitle(isEdit ? 'Editar propiedad' : 'Nueva propiedad');
  const [agents, setAgents] = useState<AgentRef[]>([]);

  useEffect(() => {
    if (isAdmin) listAssignableAgents().then(setAgents).catch(() => {});
  }, [isAdmin]);

  const [form, setForm] = useState<FormState>(EMPTY);
  const [original, setOriginal] = useState<Property | null>(null);
  const [images, setImages] = useState<EditableImage[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [customAmenity, setCustomAmenity] = useState('');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!id) return;
    getPropertyById(id)
      .then((p) => {
        if (!p) {
          toast('Propiedad no encontrada', 'error');
          navigate(PATHS.admin.properties, { replace: true });
          return;
        }
        setOriginal(p);
        setForm(fromProperty(p));
        setImages((p.images ?? []).map((img) => ({ key: img.id, url: img.url, storage_path: img.storage_path, caption: img.caption })));
      })
      .finally(() => setLoading(false));
  }, [id, navigate, toast]);

  // Aviso al salir con cambios sin guardar
  useEffect(() => {
    if (!dirty) return;
    const onBefore = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBefore);
    return () => window.removeEventListener('beforeunload', onBefore);
  }, [dirty]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  };

  const bind = (key: keyof FormState) => ({
    value: form[key] as string,
    onChange: (e: { target: { value: string } }) => set(key, e.target.value as never),
  });

  const toggleAmenity = (a: string) =>
    set('amenities', form.amenities.includes(a) ? form.amenities.filter((x) => x !== a) : [...form.amenities, a]);

  const addCustomAmenity = () => {
    const v = customAmenity.trim();
    if (v && !form.amenities.includes(v)) set('amenities', [...form.amenities, v]);
    setCustomAmenity('');
  };

  const extraAmenities = useMemo(() => form.amenities.filter((a) => !AMENITIES.includes(a)), [form.amenities]);
  const isLand = form.property_type === 'terreno';

  const validate = (status: PropertyStatus) => {
    const e: Record<string, string> = {};
    if (form.title.trim().length < 5) e.title = 'Escribe un título de al menos 5 caracteres';
    if (status !== 'draft') {
      if (!(Number(form.price) > 0)) e.price = 'Indica el precio';
      if (!form.city.trim()) e.city = 'Indica la ciudad';
      if (images.length === 0) e.images = 'Sube al menos una foto para publicar';
    }
    if (form.latitude && (Number(form.latitude) < -90 || Number(form.latitude) > 90)) e.latitude = 'Latitud inválida';
    if (form.longitude && (Number(form.longitude) < -180 || Number(form.longitude) > 180)) e.longitude = 'Longitud inválida';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async (statusOverride?: PropertyStatus) => {
    const status = statusOverride ?? form.status;
    if (!validate(status)) {
      toast('Revisa los campos marcados', 'error');
      return;
    }
    setSaving(true);
    setProgress('Guardando datos…');
    const payload: PropertyInput = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      status,
      operation_type: form.operation_type,
      property_type: form.property_type,
      price: Number(form.price) || 0,
      currency: form.currency,
      maintenance_fee: toNum(form.maintenance_fee),
      bedrooms: toInt(form.bedrooms),
      bathrooms: toInt(form.bathrooms),
      half_bathrooms: toInt(form.half_bathrooms),
      parking_spaces: toInt(form.parking_spaces),
      construction_m2: toNum(form.construction_m2),
      land_m2: toNum(form.land_m2),
      floors: toNum(form.floors),
      year_built: toNum(form.year_built),
      state: form.state.trim() || null,
      city: form.city.trim() || null,
      neighborhood: form.neighborhood.trim() || null,
      address: form.address.trim() || null,
      postal_code: form.postal_code.trim() || null,
      latitude: toNum(form.latitude),
      longitude: toNum(form.longitude),
      amenities: form.amenities,
      video_url: form.video_url.trim() || null,
      featured: form.featured,
      cover_image_url: original?.cover_image_url ?? null,
      source: original?.source ?? 'manual',
      easybroker_id: original?.easybroker_id ?? null,
      // El asesor siempre queda asignado a sí mismo (lo refuerza un trigger en la BD)
      agent_id: isAdmin ? form.agent_id || null : profile?.id ?? null,
    };

    try {
      const saved = isEdit && id ? await updateProperty(id, payload) : await createProperty(payload);
      const pending = images.filter((i) => i.file).length;
      if (pending || removed.length || isEdit || images.length) {
        setProgress(pending ? `Subiendo fotos 0/${pending}…` : 'Actualizando fotos…');
        await syncPropertyImages(saved.id, images, removed, (d, t) => setProgress(`Subiendo fotos ${d}/${t}…`));
      }
      setDirty(false);
      setRemoved([]);
      toast(isEdit ? 'Cambios guardados' : 'Propiedad creada');
      if (!isEdit) {
        navigate(editPropertyUrl(saved.id), { replace: true });
      } else {
        const fresh = await getPropertyById(saved.id);
        if (fresh) {
          setOriginal(fresh);
          setForm(fromProperty(fresh));
          setImages((fresh.images ?? []).map((img) => ({ key: img.id, url: img.url, storage_path: img.storage_path, caption: img.caption })));
        }
      }
    } catch (err) {
      toast((err as Error).message || 'No se pudo guardar', 'error');
    } finally {
      setSaving(false);
      setProgress('');
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    save();
  };

  const useMyLocation = () => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        set('latitude', pos.coords.latitude.toFixed(6));
        set('longitude', pos.coords.longitude.toFixed(6));
      },
      () => toast('No se pudo obtener tu ubicación', 'error'),
    );
  };

  if (loading) {
    return (
      <div className="page-loader">
        <div className="spinner" />
      </div>
    );
  }

  const hasCoords = form.latitude && form.longitude && !errors.latitude && !errors.longitude;
  const lat = Number(form.latitude);
  const lng = Number(form.longitude);

  return (
    <form onSubmit={onSubmit} noValidate>
      <Link to={PATHS.admin.properties} className={styles.back}>
        <ArrowLeft /> Propiedades
      </Link>
      <PageHeader
        title={isEdit ? 'Editar propiedad' : 'Nueva propiedad'}
        subtitle={original?.source === 'easybroker' ? `Importada de EasyBroker (${original.easybroker_id}). Al reimportarla se sobrescribirán sus datos.` : undefined}
        actions={
          isEdit && original && original.status !== 'draft' ? (
            <a href={propertyUrl(original.slug)} target="_blank" rel="noreferrer" className="btn btn--ghost">
              <ExternalLink /> Ver en el sitio
            </a>
          ) : undefined
        }
      />

      <div className={styles.layout}>
        <div className={styles.main}>
          <Panel title="Información general">
            <div className="form-grid">
              <div className="field span-full">
                <label htmlFor="title">Título *</label>
                <input id="title" className={cx('input', errors.title && 'is-invalid')} placeholder="Ej. Casa con alberca en Valle Oriente" {...bind('title')} maxLength={140} />
                {errors.title && <span className="field__error">{errors.title}</span>}
              </div>
              <div className="field">
                <label htmlFor="operation">Operación</label>
                <select id="operation" className="select" {...bind('operation_type')}>
                  <option value="sale">Venta</option>
                  <option value="rent">Renta</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="ptype">Tipo de propiedad</label>
                <select id="ptype" className="select" {...bind('property_type')}>
                  {Object.entries(PROPERTY_TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field span-full">
                <label htmlFor="desc">Descripción</label>
                <textarea id="desc" className="textarea" rows={7} placeholder="Describe la propiedad, sus espacios, acabados y la zona…" {...bind('description')} />
                <span className="field__hint">{form.description.length} caracteres · usa saltos de línea para separar párrafos</span>
              </div>
            </div>
          </Panel>

          <Panel title="Precio">
            <div className="form-grid form-grid--3">
              <div className="field">
                <label htmlFor="price">{form.operation_type === 'rent' ? 'Renta mensual *' : 'Precio *'}</label>
                <input id="price" className={cx('input', errors.price && 'is-invalid')} inputMode="decimal" placeholder="0" {...bind('price')} />
                {errors.price ? <span className="field__error">{errors.price}</span> : form.price && <span className="field__hint">{formatPrice(Number(form.price), form.currency, form.operation_type)}</span>}
              </div>
              <div className="field">
                <label htmlFor="currency">Moneda</label>
                <select id="currency" className="select" {...bind('currency')}>
                  <option value="MXN">MXN</option>
                  <option value="USD">USD</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="fee">Mantenimiento mensual</label>
                <input id="fee" className="input" inputMode="decimal" placeholder="Opcional" {...bind('maintenance_fee')} />
              </div>
            </div>
          </Panel>

          <Panel title="Características">
            <div className="form-grid form-grid--4">
              {!isLand && (
                <>
                  <div className="field">
                    <label htmlFor="bed">Recámaras</label>
                    <input id="bed" type="number" min={0} className="input" {...bind('bedrooms')} />
                  </div>
                  <div className="field">
                    <label htmlFor="bath">Baños completos</label>
                    <input id="bath" type="number" min={0} className="input" {...bind('bathrooms')} />
                  </div>
                  <div className="field">
                    <label htmlFor="half">Medios baños</label>
                    <input id="half" type="number" min={0} className="input" {...bind('half_bathrooms')} />
                  </div>
                  <div className="field">
                    <label htmlFor="park">Estacionamientos</label>
                    <input id="park" type="number" min={0} className="input" {...bind('parking_spaces')} />
                  </div>
                  <div className="field">
                    <label htmlFor="cm2">Construcción (m²)</label>
                    <input id="cm2" inputMode="decimal" className="input" {...bind('construction_m2')} />
                  </div>
                </>
              )}
              <div className="field">
                <label htmlFor="lm2">Terreno (m²)</label>
                <input id="lm2" inputMode="decimal" className="input" {...bind('land_m2')} />
              </div>
              {!isLand && (
                <>
                  <div className="field">
                    <label htmlFor="floors">Niveles</label>
                    <input id="floors" type="number" min={0} className="input" {...bind('floors')} />
                  </div>
                  <div className="field">
                    <label htmlFor="year">Año de construcción</label>
                    <input id="year" type="number" min={1900} max={2100} className="input" {...bind('year_built')} />
                  </div>
                </>
              )}
            </div>
          </Panel>

          <Panel title="Ubicación">
            <div className="form-grid form-grid--3">
              <div className="field">
                <label htmlFor="state">Estado</label>
                <input id="state" className="input" list="mx-states" {...bind('state')} />
                <datalist id="mx-states">
                  {MX_STATES.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>
              <div className="field">
                <label htmlFor="city">Ciudad / Municipio *</label>
                <input id="city" className={cx('input', errors.city && 'is-invalid')} {...bind('city')} />
                {errors.city && <span className="field__error">{errors.city}</span>}
              </div>
              <div className="field">
                <label htmlFor="col">Colonia</label>
                <input id="col" className="input" {...bind('neighborhood')} />
              </div>
              <div className="field span-2">
                <label htmlFor="addr">Calle y número</label>
                <input id="addr" className="input" placeholder="Opcional · se muestra en el detalle" {...bind('address')} />
              </div>
              <div className="field">
                <label htmlFor="cp">Código postal</label>
                <input id="cp" className="input" inputMode="numeric" maxLength={5} {...bind('postal_code')} />
              </div>
              <div className="field">
                <label htmlFor="lat">Latitud</label>
                <input id="lat" className={cx('input', errors.latitude && 'is-invalid')} inputMode="decimal" placeholder="25.6866" {...bind('latitude')} />
              </div>
              <div className="field">
                <label htmlFor="lng">Longitud</label>
                <input id="lng" className={cx('input', errors.longitude && 'is-invalid')} inputMode="decimal" placeholder="-100.3161" {...bind('longitude')} />
              </div>
              <div className="field" style={{ justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn--ghost" onClick={useMyLocation}>
                  <MapPin /> Usar mi ubicación
                </button>
              </div>
            </div>
            <p className="field__hint" style={{ marginTop: 10 }}>
              Tip: en Google Maps haz clic derecho sobre la propiedad y copia las coordenadas.
            </p>
            {hasCoords && (
              <div className={styles.map}>
                <iframe
                  title="Vista previa del mapa"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.006},${lat - 0.006},${lng + 0.006},${lat + 0.006}&layer=mapnik&marker=${lat},${lng}`}
                />
              </div>
            )}
          </Panel>

          <Panel title="Amenidades">
            <div className={styles.amenities}>
              {[...AMENITIES, ...extraAmenities].map((a) => (
                <label key={a} className={cx(styles.amenity, form.amenities.includes(a) && styles.amenityOn)}>
                  <input type="checkbox" checked={form.amenities.includes(a)} onChange={() => toggleAmenity(a)} />
                  {a}
                </label>
              ))}
            </div>
            <div className={styles.customAmenity}>
              <input
                className="input"
                placeholder="Agregar otra amenidad"
                value={customAmenity}
                onChange={(e) => setCustomAmenity(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomAmenity();
                  }
                }}
              />
              <button type="button" className="btn btn--ghost" onClick={addCustomAmenity}>
                Agregar
              </button>
            </div>
          </Panel>

          <Panel title={`Fotos (${images.length})`}>
            <ImageManager
              images={images}
              onChange={(imgs) => {
                setImages(imgs);
                setDirty(true);
              }}
              onRemove={(img) => img.storage_path && setRemoved((r) => [...r, img.storage_path!])}
            />
            {errors.images && (
              <span className="field__error" style={{ display: 'block', marginTop: 8 }}>
                {errors.images}
              </span>
            )}
          </Panel>

          <Panel title="Multimedia">
            <div className="field">
              <label htmlFor="video">Video o recorrido virtual (URL)</label>
              <input id="video" className="input" placeholder="https://youtube.com/…" {...bind('video_url')} />
            </div>
          </Panel>
        </div>

        <aside className={styles.aside}>
          <Panel title="Publicación">
            <div className={styles.statusList}>
              {(['active', 'draft', 'paused', 'finished'] as PropertyStatus[]).map((s) => (
                <label key={s} className={cx(styles.statusOpt, form.status === s && styles.statusOn)}>
                  <input type="radio" name="status" checked={form.status === s} onChange={() => set('status', s)} />
                  <div>
                    <strong>{STATUS_LABELS[s]}</strong>
                    <span>
                      {s === 'active' && 'Visible en el sitio y el buscador'}
                      {s === 'draft' && 'Oculta; solo la ve el equipo'}
                      {s === 'finished' && `Marcada como ${form.operation_type === 'sale' ? 'vendida' : 'rentada'}`}
                      {s === 'paused' && 'Guardada sin publicar hasta que la reactives'}
                    </span>
                  </div>
                </label>
              ))}
            </div>
            {isAdmin && (
              <label className="checkbox" style={{ marginTop: 14 }}>
                <input type="checkbox" checked={form.featured} onChange={(e) => set('featured', e.target.checked)} />
                Destacar en la página de inicio
              </label>
            )}

            <div className={styles.saveBox}>
              {progress && <span className={styles.progress}>{progress}</span>}
              <button type="submit" className="btn btn--primary btn--block" disabled={saving}>
                {saving ? <span className="spinner spinner--sm spinner--light" /> : <Save />} Guardar
              </button>
              {form.status !== 'active' && (
                <button type="button" className="btn btn--outline btn--block" disabled={saving} onClick={() => save('active')}>
                  Guardar y publicar
                </button>
              )}
            </div>
          </Panel>

          <Panel title="Asesor asignado">
            {isAdmin ? (
              <div className="field">
                <select className="select" value={form.agent_id} onChange={(e) => set('agent_id', e.target.value)} aria-label="Asesor asignado">
                  <option value="">Sin asignar (contacto general)</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.full_name || 'Sin nombre'}
                    </option>
                  ))}
                </select>
                <span className="field__hint">El asesor verá esta propiedad en su panel y aparecerá en el detalle como contacto.</span>
              </div>
            ) : (
              <div className={styles.agentBox}>
                <Avatar name={profile?.full_name} src={profile?.avatar_url} size={40} />
                <div>
                  <strong>{profile?.full_name || 'Tú'}</strong>
                  <span>Esta propiedad está asignada a ti</span>
                </div>
              </div>
            )}
            {isAdmin && form.agent_id && (
              <div className={styles.agentBox} style={{ marginTop: 12 }}>
                <Avatar name={agents.find((a) => a.id === form.agent_id)?.full_name} src={agents.find((a) => a.id === form.agent_id)?.avatar_url} size={40} />
                <div>
                  <strong>{agents.find((a) => a.id === form.agent_id)?.full_name}</strong>
                  <span>Contacto mostrado en el sitio</span>
                </div>
              </div>
            )}
          </Panel>

          {original && (
            <Panel title="Resumen">
              <dl className={styles.summary}>
                <dt>ID</dt>
                <dd>{original.code}</dd>
                <dt>Vistas</dt>
                <dd>{original.views_count}</dd>
                <dt>Origen</dt>
                <dd>{original.source === 'easybroker' ? 'EasyBroker' : 'Manual'}</dd>
                <dt>URL</dt>
                <dd className={styles.slug}>{propertyUrl(original.slug)}</dd>
              </dl>
            </Panel>
          )}
        </aside>
      </div>
    </form>
  );
}
