'use client';

import { useState, useTransition, type SyntheticEvent } from 'react';
import { Check, KeyRound, Plus, ShieldCheck, ShieldOff, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DEPARTMENT_META,
  STAFF_DEPARTMENTS,
  type StaffDepartment,
} from '@/lib/staff-portal/constants';
import type { StaffPortalAccount } from '@/lib/staff-portal/types';
import {
  createPortalAccountAction,
  resetAccountPasswordAction,
  setAccountActiveAction,
  setAccountDepartmentAction,
} from '@/app/staff/portal-access-actions';

const fieldClass =
  'mt-1.5 h-10 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none transition placeholder:text-muted-foreground/70 focus:border-ring focus:ring-2 focus:ring-ring/20';

export function StaffPortalAccessPanel({
  staffMembers,
  initialAccounts,
}: {
  staffMembers: { id: number; name: string }[];
  initialAccounts: StaffPortalAccount[];
}) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<StaffPortalAccount | null>(null);
  const [pending, startTransition] = useTransition();

  function toggleActive(account: StaffPortalAccount) {
    startTransition(async () => {
      await setAccountActiveAction(account.id, !account.active);
      setAccounts((current) =>
        current.map((item) => (item.id === account.id ? { ...item, active: !item.active } : item)),
      );
    });
  }

  function toggleDepartment(account: StaffPortalAccount, department: StaffDepartment) {
    const current = account.departments.find((grant) => grant.department === department);
    const nextActive = !current?.active;
    startTransition(async () => {
      await setAccountDepartmentAction(account.id, department, nextActive);
      setAccounts((list) =>
        list.map((item) => {
          if (item.id !== account.id) return item;
          const hasGrant = item.departments.some((grant) => grant.department === department);
          const departments = hasGrant
            ? item.departments.map((grant) =>
                grant.department === department ? { ...grant, active: nextActive } : grant,
              )
            : [...item.departments, { department, active: nextActive, role: 'staff' as const }];
          return { ...item, departments };
        }),
      );
    });
  }

  return (
    <div className="space-y-6">
      <Card className="gap-0 overflow-hidden border-border py-0 shadow-level-1 ring-0">
        <CardHeader className="border-b bg-[#fcfaf7] px-5 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Staff portal logins</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Control who can sign in to the staff portal and what they can see. Click a department
                badge to grant or remove it.
              </p>
            </div>
            <Button type="button" size="sm" onClick={() => setCreating(true)}>
              <Plus /> Create login
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {accounts.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="border-b bg-[#f7f4ef] text-xs text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-medium">Staff</th>
                    <th className="px-5 py-3 font-medium">Login ID</th>
                    <th className="px-5 py-3 font-medium">Departments</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((account) => (
                    <tr key={account.id} className="border-b last:border-0 hover:bg-[#fcfaf7]">
                      <td className="px-5 py-4 font-semibold">{account.name}</td>
                      <td className="px-5 py-4 text-muted-foreground">{account.loginId}</td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          {STAFF_DEPARTMENTS.map((department) => {
                            const grant = account.departments.find(
                              (item) => item.department === department,
                            );
                            const active = Boolean(grant?.active);
                            return (
                              <button
                                key={department}
                                type="button"
                                disabled={pending || !account.active}
                                onClick={() => toggleDepartment(account, department)}
                                aria-pressed={active}
                                aria-label={`${active ? 'Remove' : 'Grant'} ${DEPARTMENT_META[department].label} access for ${account.name}`}
                              >
                                <Badge
                                  variant="outline"
                                  className={
                                    active
                                      ? 'cursor-pointer border-[#e4d2b6] bg-[#f5ead8] text-[#70481c]'
                                      : 'cursor-pointer border-stone-200 bg-stone-50 text-stone-500'
                                  }
                                >
                                  {DEPARTMENT_META[department].label}
                                </Badge>
                              </button>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <Badge
                          variant="outline"
                          className={
                            account.active
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-stone-200 bg-stone-50 text-stone-600'
                          }
                        >
                          {account.active ? 'Active' : 'Disabled'}
                        </Badge>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={() => setEditing(account)}>
                            <KeyRound /> Reset password
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={pending}
                            onClick={() => toggleActive(account)}
                            className={
                              account.active
                                ? 'text-muted-foreground hover:text-destructive'
                                : 'text-emerald-700'
                            }
                          >
                            {account.active ? <ShieldOff /> : <ShieldCheck />}
                            {account.active ? 'Disable' : 'Enable'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid min-h-56 place-items-center p-8 text-center text-sm text-muted-foreground">
              No staff portal logins yet. Create one to grant department access.
            </div>
          )}
        </CardContent>
      </Card>

      {creating ? (
        <CreateAccountDialog
          staffMembers={staffMembers}
          onClose={() => setCreating(false)}
          onCreated={(account) => {
            setAccounts((current) => [account, ...current]);
            setCreating(false);
          }}
        />
      ) : null}

      {editing ? (
        <ResetPasswordDialog account={editing} onClose={() => setEditing(null)} onSaved={() => setEditing(null)} />
      ) : null}
    </div>
  );
}

function CreateAccountDialog({
  staffMembers,
  onClose,
  onCreated,
}: {
  staffMembers: { id: number; name: string }[];
  onClose: () => void;
  onCreated: (account: StaffPortalAccount) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selectedDepartments, setSelectedDepartments] = useState<StaffDepartment[]>([]);

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    const staffMemberIdRaw = String(form.get('staffMemberId') ?? '');
    const staffMember = staffMembers.find((member) => String(member.id) === staffMemberIdRaw);
    const name = String(form.get('name') ?? '').trim() || staffMember?.name || '';
    const loginId = String(form.get('loginId') ?? '').trim();
    const password = String(form.get('password') ?? '');
    if (!name) {
      setError('Choose a staff member or enter a name.');
      setBusy(false);
      return;
    }
    if (!loginId) {
      setError('Enter a login ID.');
      setBusy(false);
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      setBusy(false);
      return;
    }
    if (selectedDepartments.length === 0) {
      setError('Grant at least one department.');
      setBusy(false);
      return;
    }

    const result = await createPortalAccountAction({
      staffMemberId: staffMember?.id ?? null,
      name,
      loginId,
      password,
      departments: selectedDepartments,
    });
    setBusy(false);
    if (result.error || !result.account) {
      setError(result.error ?? 'Could not create the login.');
      return;
    }
    onCreated(result.account);
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-[#211d18]/70 p-4 backdrop-blur-sm">
      <dialog
        open
        aria-labelledby="access-dialog-title"
        className="relative m-0 max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-[22px] border border-white/40 bg-[#fffdf9] p-0 text-foreground shadow-[0_32px_90px_rgb(20_15_10_/.35)]"
      >
        <div className="flex items-start justify-between border-b bg-[#fcfaf7] px-5 py-5 sm:px-6">
          <div>
            <h2 id="access-dialog-title" className="text-lg font-semibold tracking-[-0.03em]">
              Create staff portal login
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Grant a team member access to the staff portal.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-9 place-items-center rounded-full border bg-white text-muted-foreground transition hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4 p-5 sm:p-6">
          <label className="block text-sm">
            <span className="font-medium">Link to staff directory (optional)</span>
            <select name="staffMemberId" className={fieldClass} defaultValue="">
              <option value="">— Not linked —</option>
              {staffMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium">Display name</span>
            <input name="name" placeholder="Full name" className={fieldClass} />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Login ID</span>
            <input name="loginId" required placeholder="e.g. warehouse1" className={fieldClass} />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Temporary password</span>
            <input name="password" required minLength={6} placeholder="At least 6 characters" className={fieldClass} />
          </label>
          <div className="text-sm">
            <span className="font-medium">Departments</span>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {STAFF_DEPARTMENTS.map((department) => (
                <label key={department} className="flex items-center gap-2 rounded-lg border border-input px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedDepartments.includes(department)}
                    onChange={(event) =>
                      setSelectedDepartments((current) =>
                        event.target.checked
                          ? [...current, department]
                          : current.filter((item) => item !== department),
                      )
                    }
                  />
                  {DEPARTMENT_META[department].label}
                </label>
              ))}
            </div>
          </div>
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Login was not created</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              <Check /> {busy ? 'Creating…' : 'Create login'}
            </Button>
          </div>
        </form>
      </dialog>
    </div>
  );
}

function ResetPasswordDialog({
  account,
  onClose,
  onSaved,
}: {
  account: StaffPortalAccount;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password') ?? '');
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      setBusy(false);
      return;
    }
    await resetAccountPasswordAction(account.id, password);
    setBusy(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-[#211d18]/70 p-4 backdrop-blur-sm">
      <dialog
        open
        aria-labelledby="reset-dialog-title"
        className="relative m-0 w-full max-w-sm rounded-[22px] border border-white/40 bg-[#fffdf9] p-0 text-foreground shadow-[0_32px_90px_rgb(20_15_10_/.35)]"
      >
        <div className="flex items-start justify-between border-b bg-[#fcfaf7] px-5 py-5">
          <h2 id="reset-dialog-title" className="text-lg font-semibold tracking-[-0.03em]">
            Reset password for {account.name}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-9 place-items-center rounded-full border bg-white text-muted-foreground transition hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4 p-5">
          <label className="block text-sm">
            <span className="font-medium">New password</span>
            <input name="password" required minLength={6} placeholder="At least 6 characters" className={fieldClass} />
          </label>
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Not saved</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              <Check /> {busy ? 'Saving…' : 'Save password'}
            </Button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
