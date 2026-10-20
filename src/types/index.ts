export type UserRole = 'admin' | 'agent' | 'user';
export type PropertyStatus = 'active' | 'draft' | 'finished';
export type OperationType = 'sale' | 'rent';
export type PropertyType = 'casa' | 'departamento' | 'terreno' | 'oficina' | 'local' | 'bodega' | 'otro';
export type Currency = 'MXN' | 'USD';
export type PropertySource = 'manual' | 'easybroker';
export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'won' | 'lost';
export type LeadInterest = 'venta' | 'compra' | 'renta' | 'inversion' | 'propiedad' | 'otro';

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  whatsapp: string | null;
  title: string | null;
  active: boolean;
  role: UserRole;
  created_at: string;
}

/** Datos públicos del asesor (detalle de propiedad) */
export interface PublicAgent {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  whatsapp: string | null;
  title: string | null;
  properties_count: number;
}

/** Fila del listado de asesores en el panel */
export interface AgentOverview extends Omit<Profile, 'created_at'> {
  created_at: string;
  last_sign_in_at: string | null;
  active_count: number;
  draft_count: number;
  finished_count: number;
  leads_count: number;
}

export type AgentRef = Pick<Profile, 'id' | 'full_name' | 'avatar_url'>;

export interface PropertyImage {
  id: string;
  property_id: string;
  url: string;
  storage_path: string | null;
  caption: string | null;
  position: number;
}

export interface Property {
  id: string;
  code: number;
  agent_id: string | null;
  agent?: AgentRef | null;
  slug: string;
  title: string;
  description: string | null;
  status: PropertyStatus;
  operation_type: OperationType;
  property_type: PropertyType;
  price: number;
  currency: Currency;
  maintenance_fee: number | null;
  bedrooms: number;
  bathrooms: number;
  half_bathrooms: number;
  parking_spaces: number;
  construction_m2: number | null;
  land_m2: number | null;
  floors: number | null;
  year_built: number | null;
  state: string | null;
  city: string | null;
  neighborhood: string | null;
  /** generados por la BD a partir de los nombres */
  state_slug?: string | null;
  city_slug?: string | null;
  neighborhood_slug?: string | null;
  address: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  amenities: string[];
  cover_image_url: string | null;
  video_url: string | null;
  featured: boolean;
  source: PropertySource;
  easybroker_id: string | null;
  views_count: number;
  published_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
  images?: PropertyImage[];
}

export type PropertyInput = Omit<
  Property,
  'id' | 'code' | 'agent' | 'slug' | 'state_slug' | 'city_slug' | 'neighborhood_slug' | 'views_count' | 'published_at' | 'finished_at' | 'created_at' | 'updated_at' | 'images'
> & { slug?: string };

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  interest: LeadInterest;
  message: string | null;
  property_id: string | null;
  agent_id: string | null;
  source: string;
  status: LeadStatus;
  notes: string | null;
  page_url: string | null;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  created_at: string;
  updated_at: string;
  property?: Pick<Property, 'id' | 'title' | 'slug' | 'code'> | null;
  agent?: Pick<Profile, 'id' | 'full_name'> | null;
}

export interface LeadInput {
  name: string;
  email: string;
  phone: string;
  interest: LeadInterest;
  message?: string;
  property_id?: string | null;
  source?: string;
}

export type TrackEventType =
  | 'page_view'
  | 'property_view'
  | 'click'
  | 'cta_click'
  | 'whatsapp_click'
  | 'phone_click'
  | 'email_click'
  | 'search'
  | 'lead_submit'
  | 'share'
  | 'gallery_open';

export interface NameValue {
  name: string;
  total?: number;
  sessions?: number;
}

export interface DashboardStats {
  totals: {
    sessions: number;
    visitors: number;
    page_views: number;
    property_views: number;
    avg_duration: number;
    bounce_rate: number;
    leads: number;
    clicks: number;
    searches: number;
    active_now: number;
  };
  daily: Array<{ date: string; sessions: number; page_views: number; leads: number }>;
  top_pages: Array<{ path: string; views: number; sessions: number }>;
  top_properties: Array<{ id: string; title: string; slug: string; cover_image_url: string | null; views: number; leads: number }>;
  sources: NameValue[];
  devices: NameValue[];
  clicks_by_type: NameValue[];
  top_clicks: Array<{ label: string; event_type: string; total: number }>;
  top_searches: Array<{ term: string; total: number }>;
  leads_by_interest: NameValue[];
  leads_by_status: NameValue[];
  leads_by_source: NameValue[];
  leads_by_agent: NameValue[];
}

export interface EasyBrokerListItem {
  public_id: string;
  title: string;
  thumbnail: string | null;
  location: string;
  property_type: string;
  operation: string | null;
  price: string | null;
  agent: string | null;
  imported: boolean;
}

export interface EasyBrokerListResponse {
  pagination: { page: number; limit: number; total: number; next_page?: string | null };
  items: EasyBrokerListItem[];
}

export interface EasyBrokerImportResult {
  public_id: string;
  ok: boolean;
  id?: string;
  error?: string;
  updated?: boolean;
  agent_id?: string | null;
}
