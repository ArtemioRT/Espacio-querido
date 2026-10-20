import { useRef, useState, type FormEvent } from 'react';
import { CheckCircle2 } from 'lucide-react';
import Recaptcha, { type RecaptchaHandle } from '@/components/forms/Recaptcha';
import { RECAPTCHA_SITE_KEY, submitLead } from '@/services/leads.service';
import { cx, isValidEmail, onlyDigits } from '@/utils/format';
import styles from './AgentMessageForm.module.scss';

interface Props {
  propertyId: string;
  propertyLabel: string;
  agentName?: string | null;
}

const formatPhone = (d: string) => {
  const v = d.slice(0, 10);
  if (v.length <= 2) return v;
  if (v.length <= 6) return `(${v.slice(0, 2)}) ${v.slice(2)}`;
  return `(${v.slice(0, 2)}) ${v.slice(2, 6)} ${v.slice(6)}`;
};

export default function AgentMessageForm({ propertyId, propertyLabel, agentName }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState(`Hola, me interesa la propiedad ${propertyLabel}. ¿Me podrían dar más información?`);
  const [website, setWebsite] = useState(''); // honeypot
  const [captcha, setCaptcha] = useState<string | null>(null);
  const captchaRef = useRef<RecaptchaHandle>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [serverError, setServerError] = useState('');

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (website) return;
    const errs: Record<string, string> = {};
    if (name.trim().length < 3) errs.name = 'Escribe tu nombre y apellido';
    if (!isValidEmail(email)) errs.email = 'Correo no válido';
    if (onlyDigits(phone).length !== 10) errs.phone = 'El teléfono debe tener 10 dígitos';
    if (RECAPTCHA_SITE_KEY && !captcha) errs.captcha = 'Confirma que no eres un robot';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setStatus('sending');
    setServerError('');
    try {
      await submitLead(
        { name, email, phone: onlyDigits(phone), message, interest: 'propiedad', property_id: propertyId, source: 'property_detail' },
        captcha,
      );
      setStatus('sent');
    } catch (err) {
      setServerError((err as Error).message);
      setStatus('error');
      captchaRef.current?.reset();
    }
  };

  return (
    <section className={styles.section} id="mensaje">
      <div className="container">
        <h2 className={styles.title}>Envía un mensaje al asesor</h2>
        <span className={styles.rule} />

        {status === 'sent' ? (
          <div className={cx(styles.card, styles.sent)}>
            <CheckCircle2 />
            <h3>¡Mensaje enviado!</h3>
            <p>{agentName ? `${agentName} se pondrá en contacto contigo muy pronto.` : 'Un asesor se pondrá en contacto contigo muy pronto.'}</p>
          </div>
        ) : (
          <form className={styles.card} onSubmit={onSubmit} noValidate>
            <div className={styles.grid}>
              <div className={styles.col}>
                <div className="field">
                  <label htmlFor="am-name">Nombre</label>
                  <input id="am-name" className={cx('input', styles.input, errors.name && 'is-invalid')} placeholder="Nombre Apellido" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
                  {errors.name && <span className="field__error">{errors.name}</span>}
                </div>
                <div className="field">
                  <label htmlFor="am-email">Correo</label>
                  <input id="am-email" type="email" className={cx('input', styles.input, errors.email && 'is-invalid')} placeholder="nombre@dominio.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                  {errors.email && <span className="field__error">{errors.email}</span>}
                </div>
                <div className="field">
                  <label htmlFor="am-phone">Teléfono</label>
                  <input
                    id="am-phone"
                    className={cx('input', styles.input, errors.phone && 'is-invalid')}
                    placeholder="(99) 9999 9999"
                    inputMode="numeric"
                    value={formatPhone(onlyDigits(phone))}
                    onChange={(e) => setPhone(onlyDigits(e.target.value).slice(0, 10))}
                    autoComplete="tel-national"
                  />
                  {errors.phone && <span className="field__error">{errors.phone}</span>}
                </div>
              </div>
              <div className={styles.col}>
                <div className="field">
                  <label htmlFor="am-msg">Mensaje</label>
                  <textarea id="am-msg" className={cx('textarea', styles.input)} rows={5} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} />
                </div>
                <Recaptcha ref={captchaRef} onChange={setCaptcha} />
                {errors.captcha && <span className="field__error">{errors.captcha}</span>}
              </div>
            </div>

            <input type="text" value={website} onChange={(e) => setWebsite(e.target.value)} className="sr-only" tabIndex={-1} autoComplete="off" aria-hidden="true" />

            {status === 'error' && <div className="alert alert--error">{serverError}</div>}

            <p className={styles.legal}>Al enviar aceptas nuestro aviso de privacidad.</p>
            <button type="submit" className={styles.submit} disabled={status === 'sending'}>
              {status === 'sending' ? <span className="spinner spinner--sm spinner--light" /> : 'Contactar al asesor'}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
