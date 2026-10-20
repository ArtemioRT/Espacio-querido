/**
 * Datos estructurados schema.org (JSON-LD) para buscadores y motores de IA.
 * https://schema.org/RealEstateAgent · https://schema.org/RealEstateListing
 */
import { COMPANY, PROPERTY_TYPE_LABELS, SITE_URL } from './constants';
import { locationLabel } from './format';
import { FAQS } from './content';
import type { Property, PublicAgent } from '@/types';

const abs = (path: string) => (/^https?:\/\//.test(path) ? path : `${SITE_URL}${path}`);
const socialLinks = () => Object.values(COMPANY.social).filter(Boolean);

export const ORG_ID = `${SITE_URL}/#organizacion`;

export function organizationLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'RealEstateAgent',
    '@id': ORG_ID,
    name: COMPANY.name,
    url: SITE_URL,
    logo: abs('/images/logo.webp'),
    image: abs('/images/hero.webp'),
    description:
      'Inmobiliaria en Monterrey, Nuevo León. Asesoría en compra, venta, renta e inversión de casas, departamentos, terrenos y locales comerciales, con apoyo en créditos hipotecarios.',
    telephone: COMPANY.phone.replace(/\s/g, ''),
    email: COMPANY.email,
    address: {
      '@type': 'PostalAddress',
      streetAddress: COMPANY.street,
      addressLocality: COMPANY.city,
      addressRegion: COMPANY.region,
      postalCode: COMPANY.postalCode,
      addressCountry: COMPANY.country,
    },
    geo: { '@type': 'GeoCoordinates', latitude: COMPANY.geo.lat, longitude: COMPANY.geo.lng },
    areaServed: COMPANY.areaServed.map((name) => ({ '@type': 'City', name })),
    ...(COMPANY.openingHours.length ? { openingHours: COMPANY.openingHours } : {}),
    sameAs: socialLinks(),
    knowsAbout: ['Compra de inmuebles', 'Venta de inmuebles', 'Renta de inmuebles', 'Inversión inmobiliaria', 'Créditos hipotecarios'],
  };
}

export function websiteLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: COMPANY.name,
    url: SITE_URL,
    inLanguage: 'es-MX',
    publisher: { '@id': ORG_ID },
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/propiedades?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function faqLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

export interface Crumb {
  label: string;
  to?: string;
}

export function breadcrumbLd(items: Crumb[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.label,
      ...(c.to ? { item: abs(c.to) } : {}),
    })),
  };
}

const SCHEMA_TYPE: Record<string, string> = {
  casa: 'SingleFamilyResidence',
  departamento: 'Apartment',
  terreno: 'Landform',
  oficina: 'Place',
  local: 'Place',
  bodega: 'Place',
  otro: 'Place',
};

/** Ficha de una propiedad: anuncio + inmueble + oferta + ubicación */
export function listingLd(p: Property, url: string, agent?: PublicAgent | null): Record<string, unknown> {
  const images = (p.images?.length ? p.images.map((i) => i.url) : [p.cover_image_url]).filter(Boolean) as string[];
  const residence = ['casa', 'departamento'].includes(p.property_type);
  return {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    '@id': `${abs(url)}#anuncio`,
    url: abs(url),
    name: p.title,
    description: p.description ?? undefined,
    identifier: String(p.code),
    datePosted: p.published_at ?? p.created_at,
    dateModified: p.updated_at,
    image: images,
    inLanguage: 'es-MX',
    offers: {
      '@type': 'Offer',
      price: p.price,
      priceCurrency: p.currency,
      businessFunction: p.operation_type === 'sale' ? 'http://purl.org/goodrelations/v1#Sell' : 'http://purl.org/goodrelations/v1#LeaseOut',
      availability: p.status === 'finished' ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
      ...(p.operation_type === 'rent'
        ? { priceSpecification: { '@type': 'UnitPriceSpecification', price: p.price, priceCurrency: p.currency, unitCode: 'MON' } }
        : {}),
      seller: agent?.full_name
        ? { '@type': 'RealEstateAgent', name: agent.full_name, telephone: agent.phone ?? undefined, worksFor: { '@id': ORG_ID } }
        : { '@id': ORG_ID },
    },
    about: {
      '@type': SCHEMA_TYPE[p.property_type] ?? 'Place',
      name: `${PROPERTY_TYPE_LABELS[p.property_type]} en ${locationLabel(p)}`,
      ...(residence && p.bedrooms ? { numberOfBedrooms: p.bedrooms, numberOfRooms: p.bedrooms } : {}),
      ...(residence && p.bathrooms ? { numberOfBathroomsTotal: p.bathrooms + (p.half_bathrooms ? 0.5 : 0) } : {}),
      ...(p.construction_m2 ? { floorSize: { '@type': 'QuantitativeValue', value: p.construction_m2, unitCode: 'MTK' } } : {}),
      ...(p.year_built ? { yearBuilt: p.year_built } : {}),
      ...(p.amenities.length
        ? { amenityFeature: p.amenities.map((a) => ({ '@type': 'LocationFeatureSpecification', name: a, value: true })) }
        : {}),
      address: {
        '@type': 'PostalAddress',
        ...(p.address ? { streetAddress: p.address } : {}),
        ...(p.neighborhood ? { addressNeighborhood: p.neighborhood } : {}),
        ...(p.city ? { addressLocality: p.city } : {}),
        ...(p.state ? { addressRegion: p.state } : {}),
        ...(p.postal_code ? { postalCode: p.postal_code } : {}),
        addressCountry: 'MX',
      },
      ...(p.latitude != null && p.longitude != null
        ? { geo: { '@type': 'GeoCoordinates', latitude: p.latitude, longitude: p.longitude } }
        : {}),
    },
  };
}

/** Lista de resultados (página de búsqueda) */
export function itemListLd(items: Property[], urlFor: (p: Property) => string): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: items.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: abs(urlFor(p)), name: p.title })),
  };
}
