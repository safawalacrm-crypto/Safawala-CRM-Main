import type { Metadata } from 'next';
import { StaffLoginForm } from '@/components/staff-portal/staff-login-form';

export const metadata: Metadata = { title: 'Staff Portal Login · Safawala CRM' };
export const dynamic = 'force-dynamic';

export default function StaffPortalLoginPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-surface px-4 py-10">
      <StaffLoginForm />
    </main>
  );
}
