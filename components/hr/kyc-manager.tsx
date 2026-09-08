'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';

type Staff = { id: number; name: string };
type Row = {
  id: number;
  staff_id: number;
  document_type: string;
  document_number: string | null;
  address_proof: string | null;
  bank_details_status: string;
  status: string;
  document_url: string | null;
  admin_notes: string | null;
  verified_at: string | null;
  staff_members?: { name?: string } | null;
};

const statuses = ['pending', 'verified', 'rejected'];

export function KycManager({
  initialRecords,
  staff,
}: {
  initialRecords: Row[];
  staff: Staff[];
}) {
  const [rows] = useState(initialRecords);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  function save(form: HTMLFormElement) {
    setFormError(null);
    const d = new FormData(form);
    start(async () => {
      try {
        const supabase = createClient();
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) {
          setFormError('Your session has expired. Please sign in again.');
          return;
        }

        const file = d.get('document') as File | null;
        let path: string | null = null;
        if (file && file.size) {
          path = `${auth.user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
          const upload = await supabase.storage
            .from('staff-kyc')
            .upload(path, file, { upsert: false });
          if (upload.error) {
            setFormError(`Could not upload the file: ${upload.error.message}`);
            return;
          }
        }

        const status = String(d.get('status') || 'pending');
        const payload = {
          owner_id: auth.user.id,
          staff_id: Number(d.get('staff_id')),
          document_type: String(d.get('document_type') || ''),
          document_number: String(d.get('document_number') || ''),
          address_proof: String(d.get('address_proof') || ''),
          bank_details_status: String(
            d.get('bank_details_status') || 'pending',
          ),
          status,
          document_url: path,
          admin_notes: String(d.get('admin_notes') || ''),
          verified_by: status === 'verified' ? auth.user.id : null,
          verified_at: status === 'verified' ? new Date().toISOString() : null,
        };

        const result = await supabase.from('hr_kyc_documents').insert(payload);
        if (result.error) {
          setFormError(`Could not save the document: ${result.error.message}`);
          return;
        }
        window.location.reload();
      } catch (err) {
        setFormError(
          err instanceof Error
            ? err.message
            : 'Something went wrong while saving. Please try again.',
        );
      }
    });
  }

  async function download(path: string) {
    const { data } = await createClient()
      .storage.from('staff-kyc')
      .createSignedUrl(path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="flex items-center justify-between p-5">
          <div>
            <p className="font-semibold">Staff KYC & documents</p>
            <p className="text-sm text-muted-foreground">
              Private files are protected by Supabase Storage policies.
            </p>
          </div>
          <Button
            onClick={() => {
              setFormError(null);
              setOpen(true);
            }}
          >
            Add document
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-[#faf8f4] dark:bg-[#241e17] text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3">Employee</th>
                <th className="px-5 py-3">Document</th>
                <th className="px-5 py-3">ID number</th>
                <th className="px-5 py-3">KYC status</th>
                <th className="px-5 py-3">Bank</th>
                <th className="px-5 py-3">File</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b last:border-0">
                  <td className="px-5 py-4 font-medium">
                    {row.staff_members?.name ?? 'Employee'}
                  </td>
                  <td className="px-5 py-4">{row.document_type}</td>
                  <td className="px-5 py-4">
                    {row.document_number || 'Missing'}
                  </td>
                  <td className="px-5 py-4 capitalize">{row.status}</td>
                  <td className="px-5 py-4 capitalize">
                    {row.bank_details_status?.replace('_', ' ')}
                  </td>
                  <td className="px-5 py-4">
                    {row.document_url ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => download(row.document_url!)}
                      >
                        Preview / download
                      </Button>
                    ) : (
                      <span className="text-amber-700">Missing</span>
                    )}
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-12 text-center text-muted-foreground"
                  >
                    No KYC records yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/30 p-4">
          <Card className="w-full max-w-lg">
            <CardContent className="p-6">
              <h2 className="mb-4 text-lg font-semibold">Add staff document</h2>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  save(event.currentTarget);
                }}
                className="space-y-3"
              >
                <label className="block text-sm">
                  Employee
                  <select
                    name="staff_id"
                    required
                    className="mt-1 h-10 w-full rounded border bg-white dark:bg-card px-2"
                  >
                    {staff.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  Document type
                  <input
                    name="document_type"
                    required
                    placeholder="Aadhaar, PAN, address proof…"
                    className="mt-1 h-10 w-full rounded border bg-white dark:bg-card px-2"
                  />
                </label>
                <label className="block text-sm">
                  Document number
                  <input
                    name="document_number"
                    className="mt-1 h-10 w-full rounded border bg-white dark:bg-card px-2"
                  />
                </label>
                <label className="block text-sm">
                  Address proof
                  <input
                    name="address_proof"
                    className="mt-1 h-10 w-full rounded border bg-white dark:bg-card px-2"
                  />
                </label>
                <label className="block text-sm">
                  Bank details status
                  <select
                    name="bank_details_status"
                    className="mt-1 h-10 w-full rounded border bg-white dark:bg-card px-2"
                  >
                    <option>pending</option>
                    <option>verified</option>
                    <option>not_provided</option>
                  </select>
                </label>
                <label className="block text-sm">
                  Verification status
                  <select
                    name="status"
                    className="mt-1 h-10 w-full rounded border bg-white dark:bg-card px-2"
                  >
                    {statuses.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  Document file
                  <input
                    name="document"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="mt-1 w-full rounded border bg-white dark:bg-card px-2 py-2"
                  />
                </label>
                <label className="block text-sm">
                  Admin notes
                  <textarea
                    name="admin_notes"
                    rows={2}
                    className="mt-1 w-full rounded border bg-white dark:bg-card px-2 py-2"
                  />
                </label>
                {formError ? (
                  <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {formError}
                  </p>
                ) : null}
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={pending}>
                    {pending ? 'Uploading…' : 'Save document'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
