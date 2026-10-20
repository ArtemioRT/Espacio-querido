import { useRef, useState, type DragEvent } from 'react';
import { ArrowLeft, ArrowRight, ImagePlus, Star, Trash2 } from 'lucide-react';
import { cx } from '@/utils/format';
import type { EditableImage } from '@/services/properties.service';
import styles from './ImageManager.module.scss';

interface Props {
  images: EditableImage[];
  onChange: (images: EditableImage[]) => void;
  onRemove: (img: EditableImage) => void;
  maxFiles?: number;
}

const MAX_SIZE = 10 * 1024 * 1024;
const ACCEPT = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

export default function ImageManager({ images, onChange, onRemove, maxFiles = 40 }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [error, setError] = useState('');

  const addFiles = (files: FileList | File[]) => {
    setError('');
    const list = Array.from(files);
    const valid: EditableImage[] = [];
    for (const f of list) {
      if (!ACCEPT.includes(f.type)) {
        setError(`"${f.name}" no es una imagen válida (JPG, PNG, WEBP).`);
        continue;
      }
      if (f.size > MAX_SIZE) {
        setError(`"${f.name}" pesa más de 10 MB.`);
        continue;
      }
      valid.push({ key: `${Date.now()}-${Math.random()}`, url: URL.createObjectURL(f), file: f });
    }
    const room = maxFiles - images.length;
    if (valid.length > room) setError(`Máximo ${maxFiles} fotos por propiedad.`);
    onChange([...images, ...valid.slice(0, Math.max(0, room))]);
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= images.length || from === to) return;
    const next = [...images];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  const setCaption = (i: number, caption: string) =>
    onChange(images.map((img, idx) => (idx === i ? { ...img, caption: caption.slice(0, 140) } : img)));

  const remove = (i: number) => {
    const img = images[i];
    if (img.file) URL.revokeObjectURL(img.url);
    onRemove(img);
    onChange(images.filter((_, idx) => idx !== i));
  };

  const onDropZone = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  return (
    <div>
      <div
        className={cx(styles.drop, dragOver && styles.dropActive)}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('Files')) {
            e.preventDefault();
            setDragOver(true);
          }
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDropZone}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
      >
        <ImagePlus />
        <strong>Arrastra tus fotos aquí o haz clic para seleccionarlas</strong>
        <span>JPG, PNG o WEBP · máx. 10 MB cada una · la primera foto será la portada · describe cada foto para SEO y accesibilidad</span>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT.join(',')}
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {error && (
        <div className="alert alert--error" style={{ marginTop: 10 }}>
          {error}
        </div>
      )}

      {images.length > 0 && (
        <ul className={styles.grid}>
          {images.map((img, i) => (
            <li
              key={img.key}
              className={cx(styles.item, dragIndex === i && styles.dragging)}
              draggable
              onDragStart={() => setDragIndex(i)}
              onDragOver={(e) => {
                if (dragIndex === null) return;
                e.preventDefault();
                if (dragIndex !== i) {
                  move(dragIndex, i);
                  setDragIndex(i);
                }
              }}
              onDragEnd={() => setDragIndex(null)}
            >
              <img src={img.url} alt={`Foto ${i + 1}`} />
              {i === 0 && (
                <span className={styles.cover}>
                  <Star /> Portada
                </span>
              )}
              {img.file && <span className={styles.new}>Nueva</span>}
              <div className={styles.tools}>
                <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label="Mover a la izquierda">
                  <ArrowLeft />
                </button>
                {i !== 0 && (
                  <button type="button" onClick={() => move(i, 0)} aria-label="Usar como portada" title="Usar como portada">
                    <Star />
                  </button>
                )}
                <button type="button" onClick={() => move(i, i + 1)} disabled={i === images.length - 1} aria-label="Mover a la derecha">
                  <ArrowRight />
                </button>
                <button type="button" onClick={() => remove(i)} aria-label="Eliminar foto" className={styles.del}>
                  <Trash2 />
                </button>
              </div>
              <input
                className={styles.caption}
                value={img.caption ?? ''}
                onChange={(e) => setCaption(i, e.target.value)}
                placeholder="Descripción (texto alternativo)"
                aria-label={`Descripción de la foto ${i + 1}`}
                onMouseDown={(e) => e.stopPropagation()}
                draggable={false}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
