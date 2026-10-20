import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { RECAPTCHA_SITE_KEY, submitLead } from '@/services/leads.service';
import Recaptcha, { type RecaptchaHandle } from './Recaptcha';
import { LEAD_INTEREST_LABELS } from '@/utils/constants';
import { cx, isValidEmail, onlyDigits } from '@/utils/format';
import type { LeadInterest } from '@/types';
import styles from './ContactForm.module.scss';

interface Props {
  propertyId?: string | null;
  propertyTitle?: string;
  defaultInterest?: LeadInterest | '';
  withMessage?: boolean;
  submitLabel?: string;
  className?: string;
}

const SELECTABLE: LeadInterest[] = ['compra', 'venta', 'renta', 'inversion', 'otro'];

export default function ContactForm({
  propertyId,
  propertyTitle,
  defaultInterest = '',
  withMessage = false,
  submitLabel = 'Continuar',
  className,
}: Props) {
  const [values, setValues] = useState({
    name: '',
    phone: '',
    email: '',
    interest: (propertyId ? 'propiedad' : defaultInterest) as LeadInterest | '',
    message: propertyTitle ? `Hola, me interesa la propiedad "${propertyTitle}". ¿Podrían darme más información?` : '',
    accept: true,
    website: '', // honeypot anti-spam
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [serverError, setServerError] = useState('');
  const [captcha, setCaptcha] = useState<string | null>(null);
  const captchaRef = useRef<RecaptchaHandle>(null);

  useEffect(() => {
    if (!propertyId && defaultInterest) setValues((v) => ({ ...v, interest: defaultInterest }));
  }, [defaultInterest, propertyId]);

  const set = (k: keyof typeof values) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [k]: k === 'phone' ? onlyDigits(e.target.value).slice(0, 10) : e.target.value }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (values.name.trim().length < 3) e.name = 'Escribe tu nombre y apellido';
    if (values.phone.length !== 10) e.phone = 'El teléfono debe tener 10 dígitos';
    if (!isValidEmail(values.email)) e.email = 'Correo electrónico no válido';
    if (!values.interest) e.interest = 'Selecciona una opción';
    if (!values.accept) e.accept = 'Debes aceptar el aviso de privacidad';
    if (RECAPTCHA_SITE_KEY && !captcha) e.captcha = 'Confirma que no eres un robot';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (values.website) return; // bot
    if (!validate()) return;
    setStatus('sending');
    setServerError('');
    try {
      await submitLead({
        name: values.name,
        phone: values.phone,
        email: values.email,
        interest: values.interest as LeadInterest,
        message: values.message,
        property_id: propertyId ?? null,
        source: propertyId ? 'property_detail' : 'contact_form',
      }, captcha);
      setStatus('sent');
    } catch (err) {
      setServerError((err as Error).message);
      setStatus('error');
      captchaRef.current?.reset();
    }
  };

  if (status === 'sent') {
    return (
      <div className={cx(styles.form, styles.success, className)}>
        <CheckCircle2 />
        <h3>¡Gracias, {values.name.split(' ')[0]}!</h3>
        <p>Recibimos tus datos. Uno de nuestros expertos se pondrá en contacto contigo a la brevedad.</p>
      </div>
    );
  }

  return (
    <form className={cx(styles.form, className)} onSubmit={onSubmit} noValidate>
      <div className={styles.row}>
        <div className="field">
          <label htmlFor="cf-name">Nombre *</label>
          <input id="cf-name" className={cx('input', errors.name && 'is-invalid')} placeholder="Nombre y apellido" value={values.name} onChange={set('name')} autoComplete="name" />
          {errors.name && <span className="field__error">{errors.name}</span>}
        </div>
        <div className="field">
          <label htmlFor="cf-phone">Teléfono *</label>
          <input id="cf-phone" className={cx('input', errors.phone && 'is-invalid')} placeholder="10 dígitos" inputMode="numeric" value={values.phone} onChange={set('phone')} autoComplete="tel-national" />
          {errors.phone && <span className="field__error">{errors.phone}</span>}
        </div>
      </div>

      <div className="field">
        <label htmlFor="cf-email">Correo electrónico *</label>
        <input id="cf-email" type="email" className={cx('input', errors.email && 'is-invalid')} placeholder="correo@ejemplo.com" value={values.email} onChange={set('email')} autoComplete="email" />
        {errors.email && <span className="field__error">{errors.email}</span>}
      </div>

      {!propertyId && (
        <div className="field">
          <label htmlFor="cf-interest">Quiero apoyo para: *</label>
          <select id="cf-interest" className={cx('select', errors.interest && 'is-invalid')} value={values.interest} onChange={set('interest')}>
            <option value="">Selecciona una opción</option>
            {SELECTABLE.map((i) => (
              <option key={i} value={i}>
                {LEAD_INTEREST_LABELS[i]}
              </option>
            ))}
          </select>
          {errors.interest && <span className="field__error">{errors.interest}</span>}
        </div>
      )}

      {withMessage && (
        <div className="field">
          <label htmlFor="cf-message">Mensaje</label>
          <textarea id="cf-message" className="textarea" rows={4} value={values.message} onChange={set('message')} maxLength={2000} />
        </div>
      )}

      {/* honeypot */}
      <input type="text" name="website" value={values.website} onChange={set('website')} className="sr-only" tabIndex={-1} autoComplete="off" aria-hidden="true" />

      <label className={cx('checkbox', styles.accept)}>
        <input type="checkbox" checked={values.accept} onChange={(e) => setValues((v) => ({ ...v, accept: e.target.checked }))} />
        Acepto el aviso de privacidad
      </label>
      {errors.accept && <span className="field__error">{errors.accept}</span>}

      <Recaptcha ref={captchaRef} onChange={setCaptcha} />
      {errors.captcha && <span className="field__error">{errors.captcha}</span>}

      {status === 'error' && <div className="alert alert--error">{serverError}</div>}

      <button type="submit" className={cx('btn btn--primary', styles.submit)} disabled={status === 'sending'}>
        {status === 'sending' ? <span className="spinner spinner--sm spinner--light" /> : submitLabel}
      </button>
    </form>
  );
}
