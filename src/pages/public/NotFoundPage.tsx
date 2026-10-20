import { Link } from 'react-router-dom';
import { PATHS } from '@/app/paths';
import { useSeo } from '@/hooks/useSeo';

export default function NotFoundPage({ message = 'La página que buscas no existe o fue movida.' }: { message?: string }) {
  useSeo({ title: 'Página no encontrada', noindex: true });
  return (
    <div className="container" style={{ padding: '96px 16px', textAlign: 'center' }}>
      <p style={{ fontFamily: 'var(--serif, "Playfair Display", serif)', fontSize: 72, color: '#9b1b3a', margin: 0 }}>404</p>
      <h1 style={{ fontSize: 28 }}>No encontramos lo que buscabas</h1>
      <p className="text-muted">{message}</p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 24 }}>
        <Link to={PATHS.home} className="btn btn--outline">
          Ir al inicio
        </Link>
        <Link to={PATHS.properties} className="btn btn--primary">
          Ver propiedades
        </Link>
      </div>
    </div>
  );
}
