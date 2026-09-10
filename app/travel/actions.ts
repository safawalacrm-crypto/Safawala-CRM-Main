'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { confirmStylistTicketSent } from '@/lib/event-jobs/store';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

const TICKET_BUCKET = 'stylist-tickets';
const ALLOWED_TICKET_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const MAX_TICKET_BYTES = 10 * 1024 * 1024;

async function requireAdminEmail(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
  if (profile?.role !== 'admin') redirect('/staff-portal?denied=permission');
  return data.user.email ?? 'Admin';
}

export async function confirmTicketSentAction(formData: FormData) {
  const confirmedBy = await requireAdminEmail();
  const jobId = String(formData.get('jobId') ?? '');
  const interestId = String(formData.get('interestId') ?? '');
  if (!jobId || !interestId) return;
  const result = await confirmStylistTicketSent(jobId, interestId, confirmedBy);
  if (result.error) redirect(`/travel/${jobId}/${interestId}?error=${encodeURIComponent(result.error)}`);
  revalidatePath('/travel');
  revalidatePath(`/travel/${jobId}/${interestId}`);
  revalidatePath('/staff-portal/notifications');
  revalidatePath('/staff-portal/stylist/assigned');
  redirect(`/travel/${jobId}/${interestId}?confirmed=1`);
}

// Admin uploads the actual ticket document (PDF or image) for one approved
// stylist assignment. The file is stored in a private Supabase Storage bucket
// (never public -- tickets can carry personal travel details) and the stylist
// only ever sees it through a short-lived signed URL generated server-side.
// Saving the ticket also fires the account-targeted notification the stylist
// sees in their portal (see confirmStylistTicketSent / lib/notifications/store.ts).
export async function uploadTicketAction(formData: FormData) {
  const confirmedBy = await requireAdminEmail();
  const jobId = String(formData.get('jobId') ?? '');
  const interestId = String(formData.get('interestId') ?? '');
  if (!jobId || !interestId) return;

  const file = formData.get('ticket');
  if (!(file instanceof File) || file.size === 0) {
    redirect(`/travel/${jobId}/${interestId}?error=${encodeURIComponent('Choose a ticket file (PDF, JPG, PNG or WEBP) to upload.')}`);
  }
  if (file.size > MAX_TICKET_BYTES) {
    redirect(`/travel/${jobId}/${interestId}?error=${encodeURIComponent('That file is too large. Tickets must be 10MB or smaller.')}`);
  }
  if (file.type && !ALLOWED_TICKET_TYPES.has(file.type)) {
    redirect(`/travel/${jobId}/${interestId}?error=${encodeURIComponent('Tickets must be a PDF, JPG, PNG or WEBP file.')}`);
  }

  const admin = createAdminClient();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
  const path = `${jobId}/${interestId}-${Date.now()}-${safeName}`;
  const upload = await admin.storage.from(TICKET_BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type || undefined,
  });
  if (upload.error) {
    redirect(`/travel/${jobId}/${interestId}?error=${encodeURIComponent(`Ticket upload failed: ${upload.error.message}`)}`);
  }

  const result = await confirmStylistTicketSent(jobId, interestId, confirmedBy, {
    path,
    name: file.name,
  });
  if (result.error) redirect(`/travel/${jobId}/${interestId}?error=${encodeURIComponent(result.error)}`);
  revalidatePath('/travel');
  revalidatePath(`/travel/${jobId}/${interestId}`);
  revalidatePath('/staff-portal/notifications');
  revalidatePath('/staff-portal/stylist/assigned');
  redirect(`/travel/${jobId}/${interestId}?confirmed=1`);
}
