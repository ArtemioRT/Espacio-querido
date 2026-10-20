import { useState } from 'react';

interface Props {
  name?: string | null;
  src?: string | null;
  size?: number;
  className?: string;
}

/** Foto circular con iniciales de respaldo */
export default function Avatar({ name, src, size = 36, className }: Props) {
  const [failed, setFailed] = useState(false);
  const initials = (name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join('');

  return (
    <span
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        overflow: 'hidden',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        background: '#f7eaee',
        color: '#9b1b3a',
        fontWeight: 700,
        fontSize: Math.max(11, size * 0.36),
      }}
    >
      {src && !failed ? (
        <img src={src} alt={name ?? ''} onError={() => setFailed(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        initials
      )}
    </span>
  );
}
