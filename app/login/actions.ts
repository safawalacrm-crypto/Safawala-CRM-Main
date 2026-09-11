'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type LoginState = { error: string };

function value(formData: FormData, name: string) {
  const input = formData.get(name);
  return typeof input === 'string' ? input.trim() : '';
}

export async function login(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = value(formData, 'email');
  const password = String(formData.get('password') ?? '');
  if (!email || !password) return { error: 'Enter your email and password.' };

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data.user || !data.session) {
      return { error: 'The email or password is incorrect. Please try again.' };
    }
  } catch {
    return {
      error: 'We could not connect to the login service. Please try again.',
    };
  }

  redirect('/dashboard');
}
