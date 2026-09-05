import { FileSignature } from 'lucide-react';
import { StaffRecordPage } from '@/components/staff-portal/staff-record-page';
import { requirePermission } from '@/lib/staff-portal/guard';

export default async function AgreementsPage() {
  const session = await requirePermission('agreements');
  return <StaffRecordPage session={session} title="My Agreements" subtitle="Agreements shared with your staff account" icon={<FileSignature />} heading="No agreements available" description="Agreements assigned to your staff ID by the franchise administrator will appear here." />;
}
