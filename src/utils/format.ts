import type { Currency, OperationType } from '@/types';

export function formatPrice(amount: number, currency: Currency = 'MXN', operation?: OperationType): string {
  const value = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount || 0);
  return `${value}${currency === 'USD' ? ' USD' : ''}${operation === 'rent' ? ' /mes' : ''}`;
}

export const formatNumber = (n: number | null | undefined) =>
  new Intl.NumberFormat('es-MX').format(n ?? 0);

export const formatCompact = (n: number) =>
  new Intl.NumberFormat('es-MX', { notation: 'compact', maximumFractionDigits: 1 }).format(n);

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds || 0));
  const m = Math.floor(s / 60);
  const rest = s % 60;
  if (m === 0) return `${rest}s`;
  if (m < 60) return `${m}m ${rest.toString().padStart(2, '0')}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function formatDate(iso: string | null | undefined, withTime = false): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(new Date(iso));
}

export function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
  if (diff < 60) return 'hace un momento';
  if (diff < 3600) return rtf.format(-Math.floor(diff / 60), 'minute');
  if (diff < 86400) return rtf.format(-Math.floor(diff / 3600), 'hour');
  if (diff < 2592000) return rtf.format(-Math.floor(diff / 86400), 'day');
  return formatDate(iso);
}

export function locationLabel(p: { neighborhood?: string | null; city?: string | null; state?: string | null }) {
  return [p.neighborhood, p.city, p.state].filter(Boolean).join(', ');
}

export const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
export const onlyDigits = (v: string) => v.replace(/\D/g, '');

export function toCsv(rows: Array<Record<string, unknown>>): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n');
}

export function downloadFile(content: string, filename: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob(['﻿' + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');
