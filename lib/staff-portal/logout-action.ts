'use server';

import { redirect } from 'next/navigation';
import { clearStaffSessionCookie } from './session';

export async function staffLogoutAction() {
  await clearStaffSessionCookie();
  redirect('/staff-portal/login');
}
