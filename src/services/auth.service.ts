import { supabase } from '@/lib/supabase';
import { PATHS } from '@/app/paths';
import type { Profile } from '@/types';

const translate = (msg: string) => {
  if (/invalid login credentials/i.test(msg)) return 'Correo o contraseña incorrectos.';
  if (/email not confirmed/i.test(msg)) return 'Tu correo aún no ha sido confirmado.';
  if (/rate limit|too many/i.test(msg)) return 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.';
  if (/should be different/i.test(msg)) return 'La nueva contraseña debe ser distinta a la anterior.';
  if (/password should be at least/i.test(msg)) return 'La contraseña debe tener al menos 8 caracteres.';
  return msg;
};

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(translate(error.message));
  return data;
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function sendPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}${PATHS.admin.reset}`,
  });
  if (error) throw new Error(translate(error.message));
}

export async function updatePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(translate(error.message));
}

export async function reauthenticate(email: string, currentPassword: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
  if (error) throw new Error('La contraseña actual no es correcta.');
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

export async function updateProfile(
  userId: string,
  patch: Partial<Pick<Profile, 'full_name' | 'avatar_url' | 'phone' | 'whatsapp' | 'title'>>,
) {
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
  if (error) throw error;
}

export function passwordStrength(pw: string): { score: number; label: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const labels = ['Muy débil', 'Débil', 'Regular', 'Buena', 'Fuerte', 'Excelente'];
  return { score, label: labels[score] };
}
