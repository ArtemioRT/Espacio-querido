export const PATHS = {
  home: '/',
  properties: '/propiedades',
  propertyDetail: '/propiedades/:slug',
  propertySheet: '/propiedades/:slug/ficha',
  privacy: '/aviso-de-privacidad',
  admin: {
    root: '/admin',
    login: '/admin/login',
    forgot: '/admin/recuperar-contrasena',
    reset: '/admin/restablecer-contrasena',
    dashboard: '/admin',
    leads: '/admin/leads',
    properties: '/admin/propiedades',
    newProperty: '/admin/propiedades/nueva',
    editProperty: '/admin/propiedades/:id/editar',
    account: '/admin/cuenta',
    agents: '/admin/asesores',
  },
} as const;

export const propertyUrl = (slug: string) => `/propiedades/${slug}`;
export const propertySheetUrl = (slug: string) => `/propiedades/${slug}/ficha`;
export const agentPropertiesUrl = (agentId: string) => `/propiedades?agent=${agentId}`;
export const editPropertyUrl = (id: string) => `/admin/propiedades/${id}/editar`;
export const sectionUrl = (id: string, query = '') => `/${query ? `?${query}` : ''}#${id}`;
