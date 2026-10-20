import type { LeadInterest, LeadStatus, OperationType, PropertyStatus, PropertyType } from '@/types';

export const COMPANY = {
  name: 'Espacio Querido',
  phone: '+52 812 867 2791',
  phoneHref: 'tel:+528128672791',
  email: 'hola@espacioquerido.mx',
  addressLine1: 'Plaza La Salle Norte',
  addressLine2: 'Francisco Garza Sada 2925, Chepevera, 64030 Monterrey, N.L.',
  whatsapp: import.meta.env.VITE_WHATSAPP_NUMBER || '528128672791',
  // SEO local / GEO. ⚠️ Verifica las coordenadas exactas de la oficina en Google Maps
  street: 'Francisco Garza Sada 2925, Plaza La Salle Norte',
  neighborhood: 'Chepevera',
  city: 'Monterrey',
  region: 'Nuevo León',
  regionCode: 'MX-NLE',
  postalCode: '64030',
  country: 'MX',
  geo: { lat: 25.6939, lng: -100.3445 },
  areaServed: ['Monterrey', 'Área metropolitana de Monterrey', 'Nuevo León'],
  // Opcional: horario en formato schema.org, p. ej. ['Mo-Fr 09:00-19:00', 'Sa 10:00-14:00']
  openingHours: [] as string[],
  // ⚠️ Confirma que estas sean las cuentas reales antes de publicar
  social: {
    facebook: 'https://www.facebook.com/espacioquerido',
    instagram: 'https://www.instagram.com/espacioquerido',
    linkedin: 'https://www.linkedin.com/company/espacioquerido',
  },
};

export const SITE_URL = (import.meta.env.VITE_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : 'https://espacioquerido.mx')).replace(/\/$/, '');

export const whatsappUrl = (text: string) =>
  `https://wa.me/${COMPANY.whatsapp}?text=${encodeURIComponent(text)}`;

export const OPERATION_LABELS: Record<OperationType, string> = {
  sale: 'Venta',
  rent: 'Renta',
};

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  casa: 'Casa',
  departamento: 'Departamento',
  terreno: 'Terreno',
  oficina: 'Oficina',
  local: 'Local comercial',
  bodega: 'Bodega / Nave',
  otro: 'Otro',
};

export const STATUS_LABELS: Record<PropertyStatus, string> = {
  active: 'Activo',
  draft: 'Borrador',
  finished: 'Finalizado',
  paused: 'En pausa',
};

export const STATUS_BADGE: Record<PropertyStatus, string> = {
  active: 'badge--success',
  draft: 'badge--muted',
  finished: 'badge--primary',
  paused: 'badge--warning',
};

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'Nuevo',
  contacted: 'Contactado',
  qualified: 'Calificado',
  won: 'Cerrado',
  lost: 'Perdido',
};

export const LEAD_STATUS_BADGE: Record<LeadStatus, string> = {
  new: 'badge--info',
  contacted: 'badge--warning',
  qualified: 'badge--primary',
  won: 'badge--success',
  lost: 'badge--muted',
};

export const LEAD_INTEREST_LABELS: Record<LeadInterest, string> = {
  venta: 'Vender',
  compra: 'Comprar',
  renta: 'Rentar',
  inversion: 'Invertir',
  propiedad: 'Propiedad específica',
  otro: 'Otro',
};

export const EVENT_LABELS: Record<string, string> = {
  click: 'Clicks generales',
  cta_click: 'Botones CTA',
  whatsapp_click: 'WhatsApp',
  phone_click: 'Llamadas',
  email_click: 'Correo',
  share: 'Compartir',
  gallery_open: 'Galería',
};

export const AMENITIES: string[] = [
  'Alberca',
  'Jardín',
  'Gimnasio',
  'Seguridad 24/7',
  'Acceso controlado',
  'Terraza',
  'Roof garden',
  'Cuarto de servicio',
  'Área de juegos',
  'Salón de eventos',
  'Asador',
  'Elevador',
  'Aire acondicionado',
  'Calefacción',
  'Cocina integral',
  'Amueblado',
  'Mascotas permitidas',
  'Vista panorámica',
  'Bodega',
  'Estudio',
  'Walk-in closet',
  'Lavandería',
  'Paneles solares',
  'Cisterna',
  'Casa club',
  'Cancha de pádel',
  'Coworking',
];

export const MX_STATES = [
  'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche', 'Chiapas', 'Chihuahua',
  'Ciudad de México', 'Coahuila', 'Colima', 'Durango', 'Estado de México', 'Guanajuato', 'Guerrero',
  'Hidalgo', 'Jalisco', 'Michoacán', 'Morelos', 'Nayarit', 'Nuevo León', 'Oaxaca', 'Puebla',
  'Querétaro', 'Quintana Roo', 'San Luis Potosí', 'Sinaloa', 'Sonora', 'Tabasco', 'Tamaulipas',
  'Tlaxcala', 'Veracruz', 'Yucatán', 'Zacatecas',
];

export const PAGE_SIZE = 12;
