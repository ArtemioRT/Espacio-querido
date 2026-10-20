import { MessageCircle } from 'lucide-react';
import { whatsappUrl } from '@/utils/constants';
import styles from './WhatsAppButton.module.scss';

export default function WhatsAppButton() {
  return (
    <a
      href={whatsappUrl('¡Hola! Me gustaría recibir información de Espacio Querido.')}
      target="_blank"
      rel="noreferrer"
      className={styles.fab}
      aria-label="Escríbenos por WhatsApp"
      data-track-label="Botón flotante WhatsApp"
    >
      <MessageCircle />
    </a>
  );
}
