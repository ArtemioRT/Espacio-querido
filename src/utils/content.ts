/**
 * Contenido estático del sitio.
 * Coloca tus imágenes en /public/images con estos nombres (o cambia las rutas aquí).
 */
import type { LeadInterest } from '@/types';
import teamData from './team.json';

export const IMAGES = {
  logo: '/images/logo.svg',
  logoWhite: '/images/logo-white.svg',
  logoIcon: '/images/logo-monogram.svg',
  hero: '/images/hero.webp',
  authSide: '/images/hero.webp',
  placeholder: '/images/placeholder-property.svg',
};

export interface ServiceItem {
  id: LeadInterest;
  title: string;
  image: string;
  lines: string[];
  cta: string;
}

export const SERVICES: ServiceItem[] = [
  {
    id: 'venta',
    title: 'Venta',
    image: '/images/services/venta.webp',
    lines: ['¿Necesitas vender tu casa?', 'Te asesoramos, apoyamos y acompañamos durante todo el proceso.'],
    cta: '¡Quiero vender!',
  },
  {
    id: 'compra',
    title: 'Compra',
    image: '/images/services/compra.webp',
    lines: [
      'Te apoyamos con las mejores opciones del mercado, de acuerdo a tus necesidades y presupuesto.',
      '¡Agenda tu consultoría de compra!',
    ],
    cta: '¡Quiero comprar!',
  },
  {
    id: 'renta',
    title: 'Renta',
    image: '/images/services/renta.webp',
    lines: [
      '¿Buscas una propiedad para rentar o quieres generar ingresos rentando tu inmueble?',
      '¡Nosotros te ayudamos!',
    ],
    cta: '¡Quiero rentar!',
  },
  {
    id: 'inversion',
    title: 'Inversión',
    image: '/images/services/inversion.webp',
    lines: ['¿Quieres conocer distintas opciones de inversión?', '¡Agenda tu consultoría de inversión!'],
    cta: '¡Quiero invertir!',
  },
];

export const WHY_US = [
  'Trabajamos constantemente para que nuestros clientes se sientan cómodos con su decisión, lo hacemos con un proceso previamente revisado y con herramientas que los asesores te brindarán durante toda la toma de tu decisión.',
  'De igual manera, ofrecemos distintos servicios para cada tipo de cliente.',
  'Para nuestros clientes compradores, ofrecemos una consultoría de compra gratuita para entender mejor tus necesidades y resolver tus dudas acerca del proceso de compra y de los financiamientos.',
  'Para nuestros clientes vendedores, ofrecemos un estudio de mercado y opinión de valor, para ponerle un precio correcto a la propiedad. Así como nuestros demás servicios de precalificación de cliente, agenda de visitas, fotografías de la propiedad, publicidad pagada en portales inmobiliarios y más.',
  'Para nuestros clientes inversionistas, ofrecemos una consultoría de inversión en donde te explicaremos las distintas opciones de inversión y elegiremos la mejor para tu perfil y objetivos.',
];

export const BANKS = [
  { name: 'Banamex', logo: '/images/banks/banamex.webp' },
  { name: 'Banorte', logo: '/images/banks/banorte.webp' },
  { name: 'Banregio', logo: '/images/banks/banregio.webp' },
  { name: 'HSBC', logo: '/images/banks/hsbc.webp' },
  { name: 'Santander', logo: '/images/banks/santander.webp' },
  { name: 'Afirme', logo: '/images/banks/afirme.webp' },
  { name: 'Scotiabank', logo: '/images/banks/scotiabank.webp' },
  { name: 'Inbursa', logo: '/images/banks/inbursa.webp' },
  { name: 'BanBajío', logo: '/images/banks/banbajio.webp' },
  { name: 'Infonavit', logo: '/images/banks/infonavit.webp' },
  { name: 'Cofinavit', logo: '/images/banks/cofinavit.webp' },
  { name: 'Sofomes', logo: '/images/banks/sofomes.webp' },
];

// Orden y foto de cada integrante: src/utils/team.json (fotos en /public/images/team/)
export const TEAM = (teamData as Array<{ name: string; photo: string }>).map((m) => ({
  name: m.name,
  photo: `/images/team/${m.photo}`,
}));

export const FAQS = [
  {
    q: '¿Qué necesito si quiero vender mi propiedad?',
    a: 'Para vender tu casa necesitas primero revisar que tu papelería esté en orden: escritura, predial, INE, recibos y tus datos generales. Posterior a esto te invitamos a que nos contactes para verificar si eres candidato a la exención de impuestos.',
  },
  {
    q: '¿Cómo saber si una propiedad tiene adeudos?',
    a: 'Nuestro equipo, junto con nuestro proceso de compra, se encarga de juntar los expedientes necesarios para que se haga una investigación de la propiedad previo a la firma y con eso verificar que esté al corriente en servicios, impuestos y que toda la papelería esté correcta.',
  },
  {
    q: '¿Qué aspectos me debo de fijar al momento de comprar una propiedad?',
    a: 'Situación legal: verifica que esté todo en orden. En caso de preventas revisa que cuente con Licencia de Construcción e investiga acerca de la experiencia del desarrollador. Si estás adquiriendo una propiedad para inversión, apóyate con nosotros para asesorarte en cuanto al retorno de inversión y plusvalía de la zona.',
  },
  {
    q: '¿Gastos ocultos al momento de comprar?',
    a: 'Antes de comprar, recuerda que debes contemplar al menos el 10% del valor total de la propiedad como enganche. Además, el comprador debe cubrir los gastos notariales y pagar el Impuesto sobre la Adquisición de Inmuebles (ISAI), los cuales representan entre un 5% y 6% sobre el valor de la operación.',
  },
  {
    q: '¿Me conviene comprar una propiedad?',
    a: 'La mejor forma de protegerte contra la inflación es con un activo que suba de valor año con año y que te pueda dar un flujo todos los meses. ¿Qué es? ¡Adivinaste! Una propiedad sube de valor todos los años y al rentarla se puede convertir en un activo con flujo constante. ¡Invierte con nosotros!',
  },
];
