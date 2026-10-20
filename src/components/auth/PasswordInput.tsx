import { useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { passwordStrength } from '@/services/auth.service';
import styles from './PasswordInput.module.scss';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  showStrength?: boolean;
}

export default function PasswordInput({ showStrength, className, ...props }: Props) {
  const [visible, setVisible] = useState(false);
  const value = String(props.value ?? '');
  const strength = passwordStrength(value);

  return (
    <div>
      <div className={styles.wrap}>
        <input {...props} type={visible ? 'text' : 'password'} className={`input ${className ?? ''}`} />
        <button type="button" onClick={() => setVisible((v) => !v)} aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
          {visible ? <EyeOff /> : <Eye />}
        </button>
      </div>
      {showStrength && value && (
        <div className={styles.strength} data-score={strength.score}>
          <div className={styles.bars}>
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className={i < strength.score ? styles.on : ''} />
            ))}
          </div>
          <small>{strength.label}</small>
        </div>
      )}
    </div>
  );
}
