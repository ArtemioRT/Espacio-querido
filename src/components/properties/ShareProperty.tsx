import { useState } from 'react';
import { Check, Facebook, FileText, Instagram, Link2, MessageCircle } from 'lucide-react';
import { trackEvent } from '@/services/analytics.service';
import { propertySheetUrl } from '@/app/paths';
import styles from './ShareProperty.module.scss';

interface Props {
  propertyId: string;
  slug: string;
  title: string;
}

export default function ShareProperty({ propertyId, slug, title }: Props) {
  const [copied, setCopied] = useState<'link' | 'instagram' | null>(null);
  const url = window.location.origin + window.location.pathname;

  const track = (label: string) => trackEvent('share', { propertyId, label });

  const copy = async (kind: 'link' | 'instagram') => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* algunos navegadores bloquean el portapapeles */
    }
    setCopied(kind);
    setTimeout(() => setCopied(null), 2500);
  };

  // Instagram no tiene URL para compartir: en móvil usamos la hoja nativa; en escritorio copiamos el enlace
  const instagram = async () => {
    track('Instagram');
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        return;
      }
    }
    copy('instagram');
  };

  return (
    <div className={styles.share}>
      <h3>Comparte esta propiedad</h3>
      <div className={styles.icons}>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`}
          target="_blank"
          rel="noreferrer"
          aria-label="Compartir por WhatsApp"
          className={styles.wa}
          data-track="share"
          data-track-label="WhatsApp"
          data-track-property={propertyId}
        >
          <MessageCircle />
        </a>
        <button onClick={instagram} aria-label="Compartir en Instagram" className={styles.ig}>
          <Instagram />
        </button>
        <a
          href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
          target="_blank"
          rel="noreferrer"
          aria-label="Compartir en Facebook"
          className={styles.fb}
          data-track="share"
          data-track-label="Facebook"
          data-track-property={propertyId}
        >
          <Facebook />
        </a>
        <a
          href={propertySheetUrl(slug)}
          target="_blank"
          rel="noreferrer"
          aria-label="Descargar ficha en PDF"
          className={styles.pdf}
          data-track="share"
          data-track-label="PDF"
          data-track-property={propertyId}
        >
          <FileText />
        </a>
        <button
          onClick={() => {
            track('Copiar enlace');
            copy('link');
          }}
          aria-label="Copiar enlace"
          className={styles.link}
        >
          {copied === 'link' ? <Check /> : <Link2 />}
        </button>
      </div>
      {copied && (
        <p className={styles.toast} role="status">
          {copied === 'instagram' ? 'Enlace copiado: pégalo en tu historia o mensaje de Instagram.' : 'Enlace copiado.'}
        </p>
      )}
    </div>
  );
}
