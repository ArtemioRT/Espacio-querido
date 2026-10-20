import { useEffect, type ReactNode } from 'react';
import { X, type LucideIcon } from 'lucide-react';
import { useLockBody } from '@/hooks/useLockBody';
import { cx } from '@/utils/format';
import styles from './AdminUI.module.scss';

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className={styles.pageHeader}>
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}

export function Panel({ title, action, children, className, padded = true }: { title?: string; action?: ReactNode; children: ReactNode; className?: string; padded?: boolean }) {
  return (
    <section className={cx(styles.panel, className)}>
      {(title || action) && (
        <header className={styles.panelHead}>
          {title && <h2>{title}</h2>}
          {action}
        </header>
      )}
      <div className={padded ? styles.panelBody : undefined}>{children}</div>
    </section>
  );
}

export function StatCard({ icon: Icon, label, value, hint, tone = 'default' }: { icon: LucideIcon; label: string; value: ReactNode; hint?: string; tone?: 'default' | 'primary' | 'success' | 'info' | 'warning' }) {
  return (
    <div className={cx(styles.stat, styles[`tone_${tone}`])}>
      <div className={styles.statIcon}>
        <Icon />
      </div>
      <div>
        <span className={styles.statLabel}>{label}</span>
        <strong className={styles.statValue}>{value}</strong>
        {hint && <small className={styles.statHint}>{hint}</small>}
      </div>
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, size = 'md' }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' }) {
  useLockBody(open);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={cx(styles.modal, styles[`modal_${size}`])} role="dialog" aria-modal="true" aria-label={title}>
        <header className={styles.modalHead}>
          <h2>{title}</h2>
          <button onClick={onClose} aria-label="Cerrar">
            <X />
          </button>
        </header>
        <div className={styles.modalBody}>{children}</div>
        {footer && <footer className={styles.modalFoot}>{footer}</footer>}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  danger,
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <button className="btn btn--ghost" onClick={onCancel} disabled={loading}>
            Cancelar
          </button>
          <button className={cx('btn', danger ? 'btn--danger' : 'btn--primary')} onClick={onConfirm} disabled={loading}>
            {loading ? <span className="spinner spinner--sm spinner--light" /> : confirmLabel}
          </button>
        </>
      }
    >
      <p style={{ margin: 0, fontSize: 14 }}>{message}</p>
    </Modal>
  );
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: Array<{ value: T; label: string; count?: number }> }) {
  return (
    <div className={styles.tabs} role="tablist">
      {items.map((t) => (
        <button key={t.value} role="tab" aria-selected={value === t.value} className={cx(styles.tab, value === t.value && styles.tabActive)} onClick={() => onChange(t.value)}>
          {t.label}
          {t.count !== undefined && <span>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}
