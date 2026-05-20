/**
 * Divisiones del ecosistema CDCom (mismas que en server/public-main/index.html — sección #empresas).
 * Cada una incluye la misma imagen de tarjeta que en el dominio principal.
 */
const ADDRESS = '12 de octubre #16, La Huerta, Jalisco, CP 48850';
const PHONE = '+52 315-125-9871';
const EMAIL = 'cdcomcomunicaciones@gmail.com';

export const COTIZADOR_COMPANIES = [
  {
    id: 'internet',
    shortLabel: 'CDCom Internet',
    sheetTitle: 'COTIZACIÓN',
    legalName: 'CDCom Internet',
    tagline: 'Conectividad WISP de alta velocidad y estabilidad.',
    address: ADDRESS,
    phone: PHONE,
    email: EMAIL,
    rfc: '',
    template: 'internet',
    accent: '#2563eb',
    accent2: '#1e3a8a',
    logoUrl: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=400&q=80',
    logoAlt: 'CDCom Internet',
    folioBrand: 'CDINT',
  },
  {
    id: 'systems',
    shortLabel: 'CDCom Systems',
    sheetTitle: 'COTIZACIÓN',
    legalName: 'CDCom Systems',
    tagline: 'Desarrollo de software, hosting VPS y automatización.',
    address: ADDRESS,
    phone: PHONE,
    email: EMAIL,
    rfc: '',
    template: 'systems',
    accent: '#0891b2',
    accent2: '#164e63',
    logoUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&q=80',
    logoAlt: 'CDCom Systems',
    folioBrand: 'CDSYS',
  },
  {
    id: 'creative',
    shortLabel: 'CDCom Creative',
    sheetTitle: 'PROPUESTA',
    legalName: 'CDCom Creative',
    tagline: 'Branding, identidad digital y producción audiovisual.',
    address: ADDRESS,
    phone: PHONE,
    email: EMAIL,
    rfc: '',
    template: 'creative',
    accent: '#9333ea',
    accent2: '#581c87',
    logoUrl: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=400&q=80',
    logoAlt: 'CDCom Creative',
    folioBrand: 'CDCRE',
  },
  {
    id: 'energy',
    shortLabel: 'CDCom Energy',
    sheetTitle: 'COTIZACIÓN',
    legalName: 'CDCom Energy',
    tagline: 'Respaldo energético, UPS inteligentes y sistemas solares.',
    address: ADDRESS,
    phone: PHONE,
    email: EMAIL,
    rfc: '',
    template: 'energy',
    accent: '#d97706',
    accent2: '#92400e',
    logoUrl: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=400&q=80',
    logoAlt: 'CDCom Energy',
    folioBrand: 'CDENER',
  },
];

export function getCompanyById(id) {
  return COTIZADOR_COMPANIES.find((c) => c.id === id) || COTIZADOR_COMPANIES[0];
}
