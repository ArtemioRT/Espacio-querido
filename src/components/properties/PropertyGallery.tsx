import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Expand, X } from 'lucide-react';
import { trackEvent } from '@/services/analytics.service';
import { useLockBody } from '@/hooks/useLockBody';
import { IMAGES } from '@/utils/content';
import { cx } from '@/utils/format';
import styles from './PropertyGallery.module.scss';

interface Props {
  images: string[];
  /** Descripción de cada foto (caption); si falta se genera a partir del título */
  captions?: Array<string | null | undefined>;
  title: string;
  propertyId: string;
}

export default function PropertyGallery({ images: raw, captions = [], title, propertyId }: Props) {
  const images = raw.length ? raw : [IMAGES.placeholder];
  const altFor = (i: number) => captions[i] || `${title} – foto ${i + 1} de ${images.length}`;
  const [index, setIndex] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  useLockBody(lightbox);

  const go = useCallback((dir: number) => setIndex((i) => (i + dir + images.length) % images.length), [images.length]);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(false);
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox, go]);

  // Swipe en móvil
  const [touchX, setTouchX] = useState<number | null>(null);
  const onTouchEnd = (x: number) => {
    if (touchX === null) return;
    const dx = x - touchX;
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
    setTouchX(null);
  };

  const open = () => {
    setLightbox(true);
    trackEvent('gallery_open', { propertyId, label: title });
  };

  return (
    <div className={styles.gallery}>
      <div
        className={styles.main}
        onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
        onTouchEnd={(e) => onTouchEnd(e.changedTouches[0].clientX)}
      >
        <img src={images[index]} alt={altFor(index)} onClick={open} />
        {images.length > 1 && (
          <>
            <button className={cx(styles.nav, styles.prev)} onClick={() => go(-1)} aria-label="Foto anterior">
              <ChevronLeft />
            </button>
            <button className={cx(styles.nav, styles.next)} onClick={() => go(1)} aria-label="Foto siguiente">
              <ChevronRight />
            </button>
          </>
        )}
        <button className={styles.expand} onClick={open}>
          <Expand /> {index + 1} / {images.length}
        </button>
      </div>

      {images.length > 1 && (
        <div className={styles.thumbs}>
          {images.map((src, i) => (
            <button key={src + i} className={cx(styles.thumb, i === index && styles.thumbActive)} onClick={() => setIndex(i)} aria-label={`Ver foto ${i + 1}`}>
              <img src={src} alt={altFor(i)} loading="lazy" />
            </button>
          ))}
        </div>
      )}

      {lightbox && (
        <div className={styles.lightbox} role="dialog" aria-modal="true" aria-label="Galería">
          <button className={styles.close} onClick={() => setLightbox(false)} aria-label="Cerrar">
            <X />
          </button>
          <span className={styles.counter}>
            {index + 1} / {images.length}
          </span>
          <img
            src={images[index]}
            alt={altFor(index)}
            onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
            onTouchEnd={(e) => onTouchEnd(e.changedTouches[0].clientX)}
          />
          {images.length > 1 && (
            <>
              <button className={cx(styles.nav, styles.prev)} onClick={() => go(-1)} aria-label="Foto anterior">
                <ChevronLeft />
              </button>
              <button className={cx(styles.nav, styles.next)} onClick={() => go(1)} aria-label="Foto siguiente">
                <ChevronRight />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
