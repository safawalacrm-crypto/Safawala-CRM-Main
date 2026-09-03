'use client';

import { useMemo, useState, type SyntheticEvent } from 'react';
import {
  CalendarCheck2,
  Check,
  Pencil,
  Phone,
  Plus,
  Search,
  UserCheck,
  UserRound,
  UsersRound,
  UserX,
  X,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ListPagination } from '@/components/ui/list-pagination';
import { friendlyDate } from '@/lib/bookings';
import { createClient } from '@/lib/supabase/client';
import { DashboardHeader } from '@/components/layout/dashboard-header';

export type StaffMember = {
  id: number;
  name: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type StatusFilter = 'all' | 'active' | 'inactive';

const fieldClass =
  'mt-1.5 h-10 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none transition placeholder:text-muted-foreground/70 focus:border-ring focus:ring-2 focus:ring-ring/20';

export function StaffDirectory({
  initialStaff,
  assignmentCounts,
  loadError,
}: {
  initialStaff: StaffMember[];
  assignmentCounts: Record<string, number>;
  loadError: string;
}) {
  const [staff, setStaff] = useState(initialStaff);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [editing, setEditing] = useState<StaffMember | null | undefined>(
    undefined,
  );
  const [busyId, setBusyId] = useState<number | null>(null);
  const [message, setMessage] = useState(loadError);

  const visibleStaff = useMemo(() => {
    const query = search.trim().toLowerCase();
    return staff.filter((member) => {
      const matchesSearch =
        !query ||
        member.name.toLowerCase().includes(query) ||
        member.phone?.toLowerCase().includes(query);
      const matchesStatus =
        status === 'all' ||
        (status === 'active' ? member.is_active : !member.is_active);
      return matchesSearch && matchesStatus;
    });
  }, [search, staff, status]);
  const staffPageCount = Math.max(1, Math.ceil(visibleStaff.length / pageSize));
  const safeStaffPage = Math.min(page, staffPageCount);
  const pagedStaff = visibleStaff.slice(
    (safeStaffPage - 1) * pageSize,
    safeStaffPage * pageSize,
  );

  const activeCount = staff.filter((member) => member.is_active).length;
  const assignedCount = Object.values(assignmentCounts).reduce(
    (sum, count) => sum + count,
    0,
  );

  async function toggleStatus(member: StaffMember) {
    setBusyId(member.id);
    setMessage('');
    const { data, error } = await createClient()
      .from('staff_members')
      .update({ is_active: !member.is_active })
      .eq('id', member.id)
      .select('id,name,phone,is_active,created_at,updated_at')
      .single();
    if (error) setMessage(error.message);
    else
      setStaff((current) =>
        current.map((row) =>
          row.id === member.id ? (data as StaffMember) : row,
        ),
      );
    setBusyId(null);
  }

  function saved(member: StaffMember) {
    setStaff((current) => {
      const exists = current.some((row) => row.id === member.id);
      return exists
        ? current.map((row) => (row.id === member.id ? member : row))
        : [member, ...current];
    });
    setEditing(undefined);
    setMessage('');
  }

  return (
    <div className="mx-auto max-w-[1440px] space-y-6">
      <DashboardHeader
        title="Staff"
        subtitle="Sales, fulfilment and wedding-day operations team"
        actions={
          <Button type="button" size="sm" onClick={() => setEditing(null)}>
            <Plus />
            <span className="hidden sm:inline">Add staff member</span>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Metric
          icon={<UsersRound />}
          label="Total staff"
          value={staff.length}
          note="All team members"
        />
        <Metric
          icon={<UserCheck />}
          label="Active staff"
          value={activeCount}
          note={`${staff.length - activeCount} inactive`}
        />
        <Metric
          icon={<CalendarCheck2 />}
          label="Upcoming assignments"
          value={assignedCount}
          note="Across future bookings"
        />
      </div>

      {message ? (
        <Alert variant="destructive">
          <AlertTitle>Staff data could not be updated</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="gap-0 overflow-hidden border-border py-0 shadow-level-1 ring-0">
        <CardHeader className="border-b bg-[#fcfaf7] px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>All staff</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                {visibleStaff.length} of {staff.length} team members
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="relative block sm:w-72">
                <span className="sr-only">Search staff</span>
                <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Search name or phone…"
                  className={`${fieldClass} mt-0 pl-9`}
                />
              </label>
              <label>
                <span className="sr-only">Filter staff status</span>
                <select
                  value={status}
                  onChange={(event) => {
                    setStatus(event.target.value as StatusFilter);
                    setPage(1);
                  }}
                  className={`${fieldClass} mt-0 sm:w-36`}
                >
                  <option value="all">All status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
            </div>
          </div>
        </CardHeader>
        <ListPagination
          total={visibleStaff.length}
          page={safeStaffPage}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          itemLabel="staff members"
        />
        <CardContent className="p-0">
          {visibleStaff.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="border-b bg-[#f7f4ef] text-xs text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-medium">Staff member</th>
                    <th className="px-5 py-3 font-medium">Contact</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Upcoming work</th>
                    <th className="px-5 py-3 font-medium">Added</th>
                    <th className="px-5 py-3 text-right font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pagedStaff.map((member) => (
                    <StaffRow
                      key={member.id}
                      member={member}
                      assignments={assignmentCounts[String(member.id)] ?? 0}
                      busy={busyId === member.id}
                      onEdit={() => setEditing(member)}
                      onToggle={() => toggleStatus(member)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid min-h-72 place-items-center p-8 text-center">
              <div>
                <span className="mx-auto grid size-12 place-items-center rounded-full bg-accent text-primary">
                  <UserRound />
                </span>
                <h3 className="mt-4 font-semibold">No staff members found</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Adjust your search or add a new member to the team.
                </p>
                <Button
                  type="button"
                  className="mt-5"
                  onClick={() => setEditing(null)}
                >
                  <Plus />
                  Add staff member
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      {editing !== undefined ? (
        <StaffDialog
          member={editing}
          onClose={() => setEditing(undefined)}
          onSaved={saved}
        />
      ) : null}
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  note,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  note: string;
}) {
  return (
    <Card className="gap-0 border-border py-0 shadow-level-1 ring-0">
      <CardContent className="flex items-center gap-4 p-5">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-primary ring-1 ring-[#e4d2b6] [&_svg]:size-5">
          {icon}
        </span>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 text-2xl font-semibold tracking-[-0.03em]">
            {value}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{note}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function StaffRow({
  member,
  assignments,
  busy,
  onEdit,
  onToggle,
}: {
  member: StaffMember;
  assignments: number;
  busy: boolean;
  onEdit: () => void;
  onToggle: () => void;
}) {
  const initials = member.name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
  return (
    <tr className="border-b last:border-0 hover:bg-[#fcfaf7]">
      <td aria-label={`Staff member ${member.name}`} className="px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#f5ead8] text-xs font-semibold text-[#70481c] ring-1 ring-[#e4d2b6]">
            {initials}
          </span>
          <div>
            <p className="font-semibold">{member.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Staff ID · SF-{String(member.id).padStart(4, '0')}
            </p>
          </div>
        </div>
      </td>
      <td className="px-5 py-4">
        <span className="flex items-center gap-2 text-muted-foreground">
          <Phone className="size-3.5" />
          {member.phone || 'Not added'}
        </span>
      </td>
      <td className="px-5 py-4">
        <Badge
          variant="outline"
          className={
            member.is_active
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-stone-200 bg-stone-50 text-stone-600'
          }
        >
          {member.is_active ? 'Active' : 'Inactive'}
        </Badge>
      </td>
      <td className="px-5 py-4">
        <span className="font-semibold">{assignments}</span>
        <span className="ml-1 text-xs text-muted-foreground">bookings</span>
      </td>
      <td className="px-5 py-4 text-muted-foreground">
        {friendlyDate(member.created_at)}
      </td>
      <td className="px-5 py-4">
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onEdit}
            aria-label={`Edit ${member.name}`}
          >
            <Pencil />
            Edit
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={onToggle}
            aria-label={`${member.is_active ? 'Deactivate' : 'Activate'} ${member.name}`}
            className={
              member.is_active
                ? 'text-muted-foreground hover:text-destructive'
                : 'text-emerald-700'
            }
          >
            {member.is_active ? <UserX /> : <UserCheck />}
            {busy ? 'Saving…' : member.is_active ? 'Deactivate' : 'Activate'}
          </Button>
        </div>
      </td>
    </tr>
  );
}

function StaffDialog({
  member,
  onClose,
  onSaved,
}: {
  member: StaffMember | null;
  onClose: () => void;
  onSaved: (member: StaffMember) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    const readText = (key: string) => {
      const value = form.get(key);
      return typeof value === 'string' ? value.trim() : '';
    };
    const payload = {
      name: readText('name'),
      phone: readText('phone') || null,
      is_active: readText('status') === 'active',
    };
    const supabase = createClient();
    let result;
    if (member) {
      result = await supabase
        .from('staff_members')
        .update(payload)
        .eq('id', member.id)
        .select('id,name,phone,is_active,created_at,updated_at')
        .single();
    } else {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) {
        setError('Your session has expired. Please sign in again.');
        setBusy(false);
        return;
      }
      result = await supabase
        .from('staff_members')
        .insert({ ...payload, owner_id: auth.user.id })
        .select('id,name,phone,is_active,created_at,updated_at')
        .single();
    }
    if (result.error) {
      setError(
        result.error.code === '23505'
          ? 'A staff member with this name already exists.'
          : result.error.message,
      );
      setBusy(false);
      return;
    }
    onSaved(result.data as StaffMember);
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-[#211d18]/70 p-4 backdrop-blur-sm">
      <dialog
        open
        aria-labelledby="staff-dialog-title"
        className="relative m-0 w-full max-w-lg rounded-[22px] border border-white/40 bg-[#fffdf9] p-0 text-foreground shadow-[0_32px_90px_rgb(20_15_10_/.35)]"
      >
        <div className="flex items-start justify-between border-b bg-[#fcfaf7] px-5 py-5 sm:px-6">
          <div className="flex gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-primary ring-1 ring-[#e4d2b6]">
              <UserRound className="size-5" />
            </span>
            <div>
              <h2
                id="staff-dialog-title"
                className="text-lg font-semibold tracking-[-0.03em]"
              >
                {member ? 'Edit staff member' : 'Add staff member'}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {member
                  ? 'Update the team member’s directory information.'
                  : 'Save a new member to your secure staff directory.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close staff popup"
            className="grid size-9 place-items-center rounded-full border bg-white text-muted-foreground transition hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4 p-5 sm:p-6">
          <label className="block text-sm">
            <span className="font-medium">Full name</span>
            <input
              name="name"
              required
              minLength={2}
              defaultValue={member?.name ?? ''}
              placeholder="Enter staff member’s name"
              className={fieldClass}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Phone number</span>
            <input
              name="phone"
              type="tel"
              defaultValue={member?.phone ?? ''}
              placeholder="Enter contact number"
              className={fieldClass}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Staff status</span>
            <select
              name="status"
              defaultValue={member?.is_active === false ? 'inactive' : 'active'}
              className={fieldClass}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Staff member was not saved</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              <Check />
              {busy ? 'Saving…' : member ? 'Save changes' : 'Add staff member'}
            </Button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
