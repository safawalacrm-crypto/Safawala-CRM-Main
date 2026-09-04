import { redirect } from 'next/navigation';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import {
  SettingsPanel,
  type DocumentNumberSetting,
} from '@/components/settings/settings-panel';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login');

  const { data, error } = await supabase
    .from('document_number_settings')
    .select('series,prefix,next_number,number_padding,sequence_year')
    .order('series');

  return (
    <DashboardShell email={auth.user.email ?? 'Safawala user'}>
      <SettingsPanel
        currentEmail={auth.user.email ?? ''}
        initialSettings={(data ?? []) as DocumentNumberSetting[]}
        loadError={error?.message ?? ''}
      />
    </DashboardShell>
  );
}
