import 'server-only';

import { randomUUID } from 'node:crypto';
import type { StaffDepartment } from '@/lib/staff-portal/constants';
import { notifyAccount, notifyDepartment } from '@/lib/notifications/store';
import { creditPerformance } from '@/lib/performance/store';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import {
  EVENT_JOB_STAGE_KEYS,
  INITIAL_OPEN_STAGES,
  STAGE_DEPARTMENT,
  STAGE_LABEL,
  type EventJobStageKey,
} from './constants';
import type {
  BookingFinalCheck,
  CollectionItemCheck,
  ConfirmedBookingSummary,
  EventJob,
  EventJobActivityEntry,
  EventJobIssue,
  EventJobStage,
  PackingChecklist,
  QcItemCheck,
  ReturnQcItemCheck,
  ReturnWarehouseItemResult,
  StylistAccommodation,
  StylistInterest,
  StylistInterestStatus,
  StylistExecutionStatus,
  StylistTravelLeg,
  WarehouseItemPrep,
} from './types';

function normalizeJob(job: EventJob): EventJob {
  const bookingType = job.bookingType ?? (job.bookingNumber.includes('-S-') ? 'sale' : 'rental');
  return {
    ...job,
    bookingType,
    stylistsRequired: bookingType === 'rental' ? job.stylistsRequired : false,
    stylistsRequiredCount: bookingType === 'rental' ? job.stylistsRequiredCount : 0,
    stages: bookingType === 'sale'
      ? job.stages.map((stage) => stage.key === 'stylist_opportunity' && stage.status !== 'done'
        ? { ...stage, status: 'done', completedBy: 'Not applicable — sale booking' }
        : stage)
      : job.stages,
    travelPlans: (job.travelPlans ?? []).map((plan) => ({
      ...plan,
      ticketConfirmedAt: plan.ticketConfirmedAt ?? null,
      ticketConfirmedBy: plan.ticketConfirmedBy ?? null,
    })),
    stylistExecutions: job.stylistExecutions ?? [],
    collectionCheck: job.collectionCheck ?? null,
    returnQualityCheck: job.returnQualityCheck ?? null,
    returnWarehouseCheck: job.returnWarehouseCheck ?? null,
    paymentSummary: job.paymentSummary ?? null,
    bookingFinalCheck: job.bookingFinalCheck ?? null,
    performanceCredited: job.performanceCredited ?? false,
    activity: (job.activity ?? []).map((entry) => ({ ...entry, department: entry.department ?? 'system' })),
  };
}

async function readAll(): Promise<EventJob[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('event_jobs').select('state').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  const jobs = (data ?? [])
    .map((row) => row.state as EventJob)
    .filter((job) => Boolean(job?.id && Array.isArray(job.stages)))
    .map(normalizeJob);
  return jobs;
}

async function writeAll(jobs: EventJob[]) {
  if (!jobs.length) return;
  const admin = createAdminClient();
  const bookingIds = [...new Set(jobs.map((job) => job.bookingId))];
  const { data: bookings, error: bookingError } = await admin.from('bookings').select('id,owner_id').in('id', bookingIds);
  if (bookingError) throw new Error(bookingError.message);
  const owners = new Map((bookings ?? []).map((booking) => [Number(booking.id), String(booking.owner_id)]));
  const rows = jobs.flatMap((job) => {
    const ownerId = owners.get(job.bookingId);
    if (!ownerId) return [];
    return [{
      id: job.id,
      booking_id: job.bookingId,
      owner_id: ownerId,
      job_number: job.id,
      status: job.status,
      stylists_required_count: job.stylistsRequiredCount,
      payment_summary: job.paymentSummary,
      booking_final_check: job.bookingFinalCheck,
      performance_credited: job.performanceCredited,
      state: job,
      created_at: job.createdAt,
      updated_at: job.updatedAt,
      closed_at: job.closedAt,
    }];
  });
  const { error } = await admin.from('event_jobs').upsert(rows, { onConflict: 'booking_id' });
  if (error) throw new Error(error.message);

  const stageRows = jobs.flatMap((job) => job.stages.map((stage) => ({
    event_job_id: job.id,
    stage: stage.key,
    status: stage.status,
    assigned_staff_id: stage.assignedStaffId ? Number(stage.assignedStaffId) || null : null,
    opened_at: stage.openedAt,
    completed_at: stage.completedAt,
    notes: { text: stage.notes, completed_by_name: stage.completedBy },
  })));
  const { error: stageError } = await admin.from('event_job_stages').upsert(stageRows, { onConflict: 'event_job_id,stage' });
  if (stageError) throw new Error(stageError.message);

  const activityRows = jobs.flatMap((job) => job.activity.map((entry) => ({
    id: entry.id,
    event_job_id: job.id,
    actor: entry.actor,
    department: entry.department,
    action: entry.action,
    details: entry.details ?? null,
    created_at: entry.at,
  })));
  if (activityRows.length) {
    const { error: activityError } = await admin.from('event_job_activity').upsert(activityRows, { onConflict: 'id' });
    if (activityError) throw new Error(activityError.message);
  }

  const issueRows = jobs.flatMap((job) => job.issues.map((issue) => ({
    id: issue.id,
    event_job_id: job.id,
    stage: issue.stage,
    description: issue.description,
    raised_by_name: issue.raisedBy,
    raised_at: issue.raisedAt,
    resolved_at: issue.resolvedAt,
  })));
  if (issueRows.length) {
    const { error: issueError } = await admin.from('event_job_issues').upsert(issueRows, { onConflict: 'id' });
    if (issueError) throw new Error(issueError.message);
  }

  const stylistUserIds = [...new Set(jobs.flatMap((job) => job.stylistInterests.map((interest) => interest.stylistAccountId)))];
  if (stylistUserIds.length) {
    const { data: staffRows, error: staffError } = await admin.from('staff_members').select('id,user_id').in('user_id', stylistUserIds);
    if (staffError) throw new Error(staffError.message);
    const staffByUser = new Map((staffRows ?? []).map((row) => [String(row.user_id), Number(row.id)]));
    const interestRows = jobs.flatMap((job) => job.stylistInterests.flatMap((interest) => {
      const staffId = staffByUser.get(interest.stylistAccountId);
      return staffId ? [{
        id: interest.id, event_job_id: job.id, staff_id: staffId, status: interest.status,
        expressed_at: interest.expressedAt, decided_at: interest.decidedAt,
      }] : [];
    }));
    if (interestRows.length) {
      const { error: interestError } = await admin.from('event_job_stylist_interest').upsert(interestRows, { onConflict: 'id' });
      if (interestError) throw new Error(interestError.message);
    }
  }
}

// "BK-2005 -> JOB-2005"-style derivation from the real booking number, e.g.
// "SW-S-2026-0001" -> "JOB-2026-0001". Falls back to the booking id if the number
// doesn't match the expected trailing year-sequence shape, so this never throws.
export function deriveJobId(bookingNumber: string, bookingId: number): string {
  const match = bookingNumber.match(/SW-([SR])-(\d{4}-\d+)$/i);
  if (match) return `JOB-${match[1].toUpperCase()}-${match[2]}`;
  const trailing = bookingNumber.match(/(\d{4}-\d+)$/);
  if (trailing) return `JOB-${trailing[1]}-B${bookingId}`;
  return `JOB-B${bookingId}`;
}

function newStage(key: EventJobStageKey, open: boolean, now: string): EventJobStage {
  return {
    key,
    status: open ? 'open' : 'not_started',
    assignedStaffId: null,
    openedAt: open ? now : null,
    completedAt: null,
    completedBy: null,
    notes: '',
  };
}

function activityEntry(
  actor: string,
  department: string,
  action: string,
  details?: string,
): EventJobActivityEntry {
  return { id: randomUUID(), at: new Date().toISOString(), actor, department, action, details };
}

function findStage(job: EventJob, key: EventJobStageKey): EventJobStage | undefined {
  return job.stages.find((stage) => stage.key === key);
}

function setStage(job: EventJob, key: EventJobStageKey, changes: Partial<EventJobStage>): EventJob {
  return {
    ...job,
    stages: job.stages.map((stage) => (stage.key === key ? { ...stage, ...changes } : stage)),
  };
}

export async function listJobs(): Promise<EventJob[]> {
  return readAll();
}

export async function getJob(id: string): Promise<EventJob | null> {
  return (await readAll()).find((job) => job.id === id) ?? null;
}

export async function getJobByBookingId(bookingId: number): Promise<EventJob | null> {
  return (await readAll()).find((job) => job.bookingId === bookingId) ?? null;
}

// Reads a list of CONFIRMED bookings (is_quote = false and status not in
// draft/cancelled — the caller is responsible for that filter, since only a page with
// a real Supabase session can query bookings) and:
//   1. creates exactly one Central Event Job per booking that doesn't already have one
//      (duplicate-safe — never creates a second job for a bookingId that already has one)
//   2. refreshes the event/item snapshot on existing ACTIVE jobs so it doesn't go stale,
//      WITHOUT ever touching warehousePrep/qualityCheck/packingChecklist/stylistInterests
//      (those belong to the department that recorded them, never overwritten by a sync).
export async function syncEventJobs(bookings: ConfirmedBookingSummary[]): Promise<EventJob[]> {
  const jobs = await readAll();
  const byBookingId = new Map(jobs.map((job) => [job.bookingId, job] as const));
  const now = new Date().toISOString();
  let changed = false;

  for (const booking of bookings) {
    const existing = byBookingId.get(booking.bookingId);
    const eventSummary = {
      eventName: booking.eventName,
      eventDate: booking.eventDate,
      eventTime: booking.eventTime,
      venue: booking.eventLocation,
    };

    if (existing) {
      const bookingType = booking.bookingType === 'sale' ? 'sale' : 'rental';
      const stylistsRequired = bookingType === 'rental';
      const snapshotChanged =
        existing.bookingType !== bookingType ||
        existing.stylistsRequired !== stylistsRequired ||
        JSON.stringify(existing.eventSummary) !== JSON.stringify(eventSummary) ||
        JSON.stringify(existing.requiredItems) !== JSON.stringify(booking.items) ||
        JSON.stringify(existing.paymentSummary) !== JSON.stringify(booking.payment);
      if (existing.status === 'active' && snapshotChanged) {
        const index = jobs.findIndex((job) => job.id === existing.id);
        jobs[index] = {
          ...jobs[index],
          bookingType,
          stylistsRequired,
          stylistsRequiredCount: stylistsRequired ? Math.max(existing.stylistsRequiredCount, 1) : 0,
          stages: stylistsRequired
            ? jobs[index].stages
            : jobs[index].stages.map((stage) => stage.key === 'stylist_opportunity'
              ? { ...stage, status: 'done', completedAt: stage.completedAt ?? now, completedBy: 'Not applicable — sale booking' }
              : stage),
          eventSummary,
          requiredItems: booking.items,
          paymentSummary: booking.payment,
          updatedAt: now,
        };
        changed = true;
      }
      continue;
    }

    const stylistsRequired = booking.bookingType === 'rental';
    const stages = EVENT_JOB_STAGE_KEYS.filter(
      (key) => stylistsRequired || key !== 'stylist_opportunity',
    ).map((key) => {
      const stage = newStage(key, INITIAL_OPEN_STAGES.includes(key), now);
      return booking.bookingType === 'sale' && ['collection', 'return_quality_check', 'return_warehouse'].includes(key)
        ? { ...stage, status: 'done' as const, completedAt: now, completedBy: 'Not applicable — sale booking' }
        : stage;
    });

    const job: EventJob = {
      id: deriveJobId(booking.bookingNumber, booking.bookingId),
      bookingId: booking.bookingId,
      bookingNumber: booking.bookingNumber,
      bookingType: booking.bookingType === 'sale' ? 'sale' : 'rental',
      eventSummary,
      requiredItems: booking.items,
      stylistsRequired,
      stylistsRequiredCount: stylistsRequired ? 1 : 0,
      status: 'active',
      stages,
      warehousePrep: null,
      qualityCheck: null,
      packingChecklist: null,
      stylistInterests: [],
      travelPlans: [],
      stylistExecutions: [],
      collectionCheck: null,
      returnQualityCheck: null,
      returnWarehouseCheck: null,
      paymentSummary: booking.payment,
      bookingFinalCheck: null,
      performanceCredited: false,
      issues: [],
      activity: [
        activityEntry(
          'system',
          'system',
          'job_created',
          `Central Event Job created from confirmed booking ${booking.bookingNumber} (status: ${booking.status}).`,
        ),
      ],
      createdAt: now,
      updatedAt: now,
      closedAt: null,
    };
    jobs.push(job);
    byBookingId.set(booking.bookingId, job);
    changed = true;
    if (stylistsRequired) {
      await notifyDepartment(job.id, 'stylist', `${job.eventSummary.eventName} (${job.id}) is open for stylist interest.`);
    }
  }

  if (changed) await writeAll(jobs);
  return jobs;
}

export function currentStageSummary(job: EventJob): string {
  if (job.status === 'closed') return 'Event closed';
  const open = job.stages.filter((stage) => stage.status === 'open' || stage.status === 'in_progress');
  if (open.length === 0) {
    const packing = findStage(job, 'packing');
    if (packing?.status === 'done') return 'Ready for event';
    return 'Awaiting next stage';
  }
  return open.map((stage) => STAGE_LABEL[stage.key]).join(' + ');
}

export async function jobsForDepartment(department: StaffDepartment) {
  const jobs = (await readAll()).filter((job) =>
    job.status === 'active' && (department !== 'stylist' || job.bookingType === 'rental'),
  );
  return jobs
    .map((job) => ({
      job,
      stages: job.stages.filter(
        (stage) =>
          STAGE_DEPARTMENT[stage.key] === department &&
          (stage.status === 'open' || stage.status === 'in_progress'),
      ),
    }))
    .filter((entry) => entry.stages.length > 0);
}

export async function addIssue(jobId: string, description: string, raisedBy: string, stage: EventJobStageKey | null) {
  const jobs = await readAll();
  const index = jobs.findIndex((job) => job.id === jobId);
  if (index === -1) return null;
  const issue: EventJobIssue = {
    id: randomUUID(),
    stage,
    description,
    raisedBy,
    raisedAt: new Date().toISOString(),
    resolved: false,
    resolvedAt: null,
  };
  jobs[index] = {
    ...jobs[index],
    issues: [issue, ...jobs[index].issues],
    activity: [activityEntry(raisedBy, 'admin', 'issue_raised', description), ...jobs[index].activity],
    updatedAt: new Date().toISOString(),
  };
  await writeAll(jobs);
  return jobs[index];
}

export async function resolveIssue(jobId: string, issueId: string, resolvedBy: string) {
  const jobs = await readAll();
  const index = jobs.findIndex((job) => job.id === jobId);
  if (index === -1) return null;
  const issues = jobs[index].issues.map((issue) =>
    issue.id === issueId ? { ...issue, resolved: true, resolvedAt: new Date().toISOString() } : issue,
  );
  jobs[index] = {
    ...jobs[index],
    issues,
    activity: [activityEntry(resolvedBy, 'admin', 'issue_resolved'), ...jobs[index].activity],
    updatedAt: new Date().toISOString(),
  };
  await writeAll(jobs);
  return jobs[index];
}

// ---- Step 4: Warehouse pre-event preparation ----------------------------------

export type WarehousePrepResult = { job?: EventJob; error?: string };

export async function submitWarehousePreparation(
  jobId: string,
  items: WarehouseItemPrep[],
  staffName: string,
): Promise<WarehousePrepResult> {
  const jobs = await readAll();
  const index = jobs.findIndex((job) => job.id === jobId);
  if (index === -1) return { error: 'Job not found.' };
  const job = jobs[index];
  const stage = findStage(job, 'warehouse_pick');
  if (!stage || (stage.status !== 'open' && stage.status !== 'in_progress')) {
    return { error: 'Warehouse preparation is not open for this job.' };
  }
  if (items.some((item) => item.preparedQuantity === null || item.preparedQuantity < 0)) {
    return { error: 'Enter a prepared quantity (0 or more) for every item before completing.' };
  }

  const now = new Date().toISOString();
  let updated: EventJob = {
    ...job,
    warehousePrep: { items, completedAt: now, completedBy: staffName },
  };
  updated = setStage(updated, 'warehouse_pick', {
    status: 'done',
    completedAt: now,
    completedBy: staffName,
  });
  updated = setStage(updated, 'quality_check', {
    status: 'open',
    openedAt: now,
  });
  await notifyDepartment(job.id, 'qc', `${job.id} — Warehouse preparation complete, ready for Quality Check.`);
  const shortages = items.filter(
    (item) => item.unavailable || item.damaged || (item.preparedQuantity ?? 0) < item.requiredQuantity,
  );
  updated = {
    ...updated,
    updatedAt: now,
    activity: [
      activityEntry(
        staffName,
        'warehouse',
        'warehouse_preparation_completed',
        shortages.length
          ? `Completed with ${shortages.length} item(s) short/unavailable/damaged.`
          : 'All required items prepared in full.',
      ),
      ...updated.activity,
    ],
  };
  jobs[index] = updated;
  await writeAll(jobs);

  return { job: updated };
}

// ---- Step 5: QC & Packing pre-event --------------------------------------------

export type QcResult = { job?: EventJob; error?: string };

export async function submitQualityCheck(jobId: string, items: QcItemCheck[], staffName: string): Promise<QcResult> {
  const jobs = await readAll();
  const index = jobs.findIndex((job) => job.id === jobId);
  if (index === -1) return { error: 'Job not found.' };
  const job = jobs[index];
  const stage = findStage(job, 'quality_check');
  if (!stage || (stage.status !== 'open' && stage.status !== 'in_progress')) {
    return { error: 'Quality check is not open for this job yet.' };
  }
  if (items.some((item) => item.checkedQuantity === null || item.goodQuantity === null)) {
    return { error: 'Enter a checked quantity and a good quantity for every item.' };
  }
  if (items.some((item) => (item.goodQuantity ?? 0) > (item.checkedQuantity ?? 0))) {
    return { error: 'Good quantity cannot be more than checked quantity.' };
  }

  const now = new Date().toISOString();
  let updated: EventJob = { ...job, qualityCheck: { items, completedAt: now, completedBy: staffName } };
  updated = setStage(updated, 'quality_check', { status: 'done', completedAt: now, completedBy: staffName });
  updated = setStage(updated, 'packing', { status: 'open', openedAt: now });
  const problems = items.reduce(
    (sum, item) => sum + Math.max((item.checkedQuantity ?? 0) - (item.goodQuantity ?? 0), 0),
    0,
  );
  updated = {
    ...updated,
    updatedAt: now,
    activity: [
      activityEntry(
        staffName,
        'qc',
        'quality_check_completed',
        problems ? `${problems} item(s) flagged with a problem.` : 'All checked items passed.',
      ),
      ...updated.activity,
    ],
  };
  jobs[index] = updated;
  await writeAll(jobs);

  return { job: updated };
}

export async function submitPackingChecklist(
  jobId: string,
  checklist: Omit<PackingChecklist, 'completedAt' | 'completedBy'>,
  staffName: string,
): Promise<QcResult> {
  const jobs = await readAll();
  const index = jobs.findIndex((job) => job.id === jobId);
  if (index === -1) return { error: 'Job not found.' };
  const job = jobs[index];
  const qcStage = findStage(job, 'quality_check');
  if (!qcStage || qcStage.status !== 'done') {
    return { error: 'Complete the quality check before packing.' };
  }
  const packingStage = findStage(job, 'packing');
  if (!packingStage || (packingStage.status !== 'open' && packingStage.status !== 'in_progress')) {
    return { error: 'Packing is not open for this job yet.' };
  }
  const allChecked =
    checklist.correctQuantityPacked &&
    checklist.correctBoxes &&
    checklist.properLabels &&
    checklist.accessoriesIncluded &&
    checklist.itemsSecured &&
    checklist.correctEventIdentification;
  if (!allChecked) {
    return { error: 'All six packing checks must be confirmed before completing packing.' };
  }

  const now = new Date().toISOString();
  let updated: EventJob = {
    ...job,
    packingChecklist: { ...checklist, completedAt: now, completedBy: staffName },
  };
  updated = setStage(updated, 'packing', { status: 'done', completedAt: now, completedBy: staffName });
  // Packing complete means products are ready for the event — Collection (post-event
  // check-in) opens now too so it's waiting for the Collection department the moment
  // the event happens. This does NOT mean the event has occurred; Collection staff are
  // simply able to see the job on their list rather than it appearing out of nowhere.
  updated = setStage(updated, job.bookingType === 'rental' ? 'collection' : 'booking_final_check', {
    status: 'open',
    openedAt: now,
  });
  updated = {
    ...updated,
    updatedAt: now,
    activity: [
      activityEntry(staffName, 'qc', 'packing_completed', 'Products packed and ready for the event.'),
      ...updated.activity,
    ],
  };
  jobs[index] = updated;
  await writeAll(jobs);
  return { job: updated };
}

// ---- Step 6: Stylist opportunity + interest ------------------------------------

export async function expressStylistInterest(jobId: string, stylistAccountId: string, stylistName: string) {
  const jobs = await readAll();
  const index = jobs.findIndex((job) => job.id === jobId);
  if (index === -1) return null;
  const job = jobs[index];
  if (job.bookingType !== 'rental' || !job.stylistsRequired) return null;
  if (job.stylistInterests.some((interest) => interest.stylistAccountId === stylistAccountId)) {
    return job; // already expressed — idempotent, no duplicate record.
  }
  const interest: StylistInterest = {
    id: randomUUID(),
    stylistAccountId,
    stylistName,
    status: 'interested',
    expressedAt: new Date().toISOString(),
    decidedAt: null,
    decidedBy: null,
  };
  jobs[index] = {
    ...job,
    stylistInterests: [...job.stylistInterests, interest],
    activity: [
      activityEntry(stylistName, 'stylist', 'stylist_interest_expressed', 'Marked as interested and available.'),
      ...job.activity,
    ],
    updatedAt: new Date().toISOString(),
  };
  await writeAll(jobs);
  return jobs[index];
}

// Admin-only by construction: only called from a Supabase-authenticated admin Server
// Action (app/stylist-approvals/actions.ts), never reachable from the Staff Portal —
// so a stylist can never approve themselves.
export async function decideStylistInterest(
  jobId: string,
  interestId: string,
  decision: StylistInterestStatus,
  decidedBy: string,
) {
  const jobs = await readAll();
  const index = jobs.findIndex((job) => job.id === jobId);
  if (index === -1) return null;
  const job = jobs[index];
  if (job.bookingType !== 'rental' || !job.stylistsRequired) return null;
  const now = new Date().toISOString();
  const interests = job.stylistInterests.map((interest) =>
    interest.id === interestId ? { ...interest, status: decision, decidedAt: now, decidedBy } : interest,
  );
  let updated: EventJob = {
    ...job,
    stylistInterests: interests,
    activity: [
      activityEntry(decidedBy, 'admin', 'stylist_interest_decided', `${decision} for interest ${interestId}.`),
      ...job.activity,
    ],
    updatedAt: now,
  };
  const decidedInterest = interests.find((interest) => interest.id === interestId);
  if (decision === 'approved' && decidedInterest) {
    await notifyAccount(
      job.id,
      decidedInterest.stylistAccountId,
      `You're approved for ${job.eventSummary.eventName} (${job.id}) — see it under My Assigned Events.`,
    );
  }

  // Once enough stylists are approved, the Stylist opportunity stage closes on its own
  // (it is a parallel track — it never blocks Warehouse/QC/Collection/Booking stages).
  // Admins can still approve/reject/backup afterwards; this only marks the stage done.
  const approvedCount = interests.filter((interest) => interest.status === 'approved').length;
  const requiredCount = Math.max(updated.stylistsRequiredCount, 1);
  const stage = findStage(updated, 'stylist_opportunity');
  if (decision === 'approved' && stage && stage.status !== 'done' && approvedCount >= requiredCount) {
    updated = setStage(updated, 'stylist_opportunity', { status: 'done', completedAt: now, completedBy: decidedBy });
    updated = {
      ...updated,
      activity: [
        activityEntry(decidedBy, 'admin', 'stylist_opportunity_filled', `${approvedCount} stylist(s) approved.`),
        ...updated.activity,
      ],
    };
  }

  // Only the required number are meant to become officially assigned — approving past
  // that is allowed (an admin-intentional exception, e.g. a late replacement) but is
  // recorded explicitly rather than happening silently.
  if (decision === 'approved' && approvedCount > requiredCount) {
    updated = {
      ...updated,
      activity: [
        activityEntry(
          decidedBy,
          'admin',
          'stylist_approved_beyond_required',
          `${approvedCount} approved vs ${requiredCount} required — treated as an intentional exception.`,
        ),
        ...updated.activity,
      ],
    };
  }

  jobs[index] = updated;
  await writeAll(jobs);
  return jobs[index];
}

export async function setStylistsRequiredCount(jobId: string, count: number) {
  const jobs = await readAll();
  const index = jobs.findIndex((job) => job.id === jobId);
  if (index === -1) return null;
  if (jobs[index].bookingType !== 'rental') return null;
  jobs[index] = { ...jobs[index], stylistsRequiredCount: count, updatedAt: new Date().toISOString() };
  await writeAll(jobs);
  return jobs[index];
}

// Jobs where THIS stylist has an APPROVED interest, regardless of whether the parallel
// stylist_opportunity stage itself is still open (it closes once enough stylists are
// approved — see decideStylistInterest) or the job's other stages have moved on. This
// is the "My Assigned Events" list — separate from the "available opportunities" list
// in jobsForDepartment('stylist'), which only shows OPEN opportunities to express
// interest in.
export async function assignedJobsForStylist(stylistAccountId: string): Promise<EventJob[]> {
  return (await readAll()).filter((job) =>
    job.bookingType === 'rental' && job.stylistInterests.some(
      (interest) => interest.stylistAccountId === stylistAccountId && (interest.status === 'approved' || interest.status === 'backup'),
    ),
  );
}

// ---- Step 8: Travel & Accommodation (admin/franchise-admin only) --------------

export type TravelPlanResult = { job?: EventJob; error?: string };

// Admin-only by construction: only imported from app/travel/actions.ts (a
// Supabase-authenticated admin Server Action), never from anything under
// app/staff-portal/. Stylists can only ever VIEW their own plan (see
// assignedJobsForStylist / the stylist "My Assigned Events" page), never edit it.
export async function upsertTravelPlan(
  jobId: string,
  interestId: string,
  data: { travelLegs: StylistTravelLeg[]; accommodation: StylistAccommodation | null },
  updatedBy: string,
): Promise<TravelPlanResult> {
  const jobs = await readAll();
  const index = jobs.findIndex((job) => job.id === jobId);
  if (index === -1) return { error: 'Job not found.' };
  const job = jobs[index];
  if (job.bookingType !== 'rental') return { error: 'Travel is available only for rental bookings.' };
  const interest = job.stylistInterests.find((entry) => entry.id === interestId);
  if (!interest) return { error: 'Stylist assignment not found on this job.' };
  if (interest.status !== 'approved') {
    return { error: 'Travel & accommodation can only be set for an approved stylist.' };
  }

  const now = new Date().toISOString();
  const existingPlan = job.travelPlans.find((plan) => plan.interestId === interestId);
  const plan = {
    interestId,
    stylistAccountId: interest.stylistAccountId,
    stylistName: interest.stylistName,
    travelLegs: data.travelLegs,
    accommodation: data.accommodation,
    updatedAt: now,
    updatedBy,
  };
  const travelPlans = existingPlan
    ? job.travelPlans.map((entry) => (entry.interestId === interestId ? plan : entry))
    : [...job.travelPlans, plan];

  const updated: EventJob = {
    ...job,
    travelPlans,
    updatedAt: now,
    activity: [
      activityEntry(updatedBy, 'admin', 'stylist_travel_updated', `Travel/accommodation updated for ${interest.stylistName}.`),
      ...job.activity,
    ],
  };
  jobs[index] = updated;
  await writeAll(jobs);
  return { job: updated };
}

export async function confirmStylistTicketSent(
  jobId: string,
  interestId: string,
  confirmedBy: string,
): Promise<TravelPlanResult> {
  const jobs = await readAll();
  const index = jobs.findIndex((job) => job.id === jobId);
  if (index === -1) return { error: 'Job not found.' };
  const job = jobs[index];
  if (job.bookingType !== 'rental') return { error: 'Tickets are available only for rental bookings.' };
  const interest = job.stylistInterests.find((entry) => entry.id === interestId);
  if (!interest || interest.status !== 'approved') {
    return { error: 'Only an approved staff assignment can receive a ticket confirmation.' };
  }

  const existingPlan = job.travelPlans.find((plan) => plan.interestId === interestId);
  if (existingPlan?.ticketConfirmedAt) return { job };

  const now = new Date().toISOString();
  const plan = {
    interestId,
    stylistAccountId: interest.stylistAccountId,
    stylistName: interest.stylistName,
    travelLegs: existingPlan?.travelLegs ?? [],
    accommodation: existingPlan?.accommodation ?? null,
    ticketConfirmedAt: now,
    ticketConfirmedBy: confirmedBy,
    updatedAt: now,
    updatedBy: confirmedBy,
  };
  const travelPlans = existingPlan
    ? job.travelPlans.map((entry) => (entry.interestId === interestId ? plan : entry))
    : [...job.travelPlans, plan];
  const updated: EventJob = {
    ...job,
    travelPlans,
    updatedAt: now,
    activity: [
      activityEntry(confirmedBy, 'admin', 'stylist_ticket_confirmed', `Ticket confirmed and sent on WhatsApp to ${interest.stylistName}.`),
      ...job.activity,
    ],
  };
  jobs[index] = updated;
  await writeAll(jobs);
  await notifyAccount(
    job.id,
    interest.stylistAccountId,
    `Your ticket for ${job.eventSummary.eventName} (${job.id}) is confirmed and has been sent to you on WhatsApp.`,
  );
  return { job: updated };
}

// ---- Step 9: Event day / stylist execution -------------------------------------

export type ExecutionAction = 'reached_venue' | 'start_work' | 'complete_work';
export type ExecutionResult = { job?: EventJob; error?: string };

const EXECUTION_ORDER: Record<ExecutionAction, StylistExecutionStatus> = {
  reached_venue: 'reached_venue',
  start_work: 'work_started',
  complete_work: 'work_completed',
};

// Reached Venue -> Start Work -> Complete Work, enforced in order. Only updates this
// stylist's own execution entry — never creates another job, never touches
// job.status, and never closes the Event Job (only Booking staff can do that).
export async function recordStylistExecution(
  jobId: string,
  stylistAccountId: string,
  stylistName: string,
  action: ExecutionAction,
  remarks: string,
): Promise<ExecutionResult> {
  const jobs = await readAll();
  const index = jobs.findIndex((job) => job.id === jobId);
  if (index === -1) return { error: 'Job not found.' };
  const job = jobs[index];
  const isApproved = job.stylistInterests.some(
    (interest) => interest.stylistAccountId === stylistAccountId && interest.status === 'approved',
  );
  if (!isApproved) return { error: 'You are not an approved stylist on this job.' };

  const now = new Date().toISOString();
  const existing = job.stylistExecutions.find((entry) => entry.stylistAccountId === stylistAccountId);
  const currentStatus: StylistExecutionStatus = existing?.status ?? 'not_started';

  const nextAllowed: Record<StylistExecutionStatus, ExecutionAction | null> = {
    not_started: 'reached_venue',
    reached_venue: 'start_work',
    work_started: 'complete_work',
    work_completed: null,
  };
  if (nextAllowed[currentStatus] !== action) {
    return { error: 'That action is not available from the current status.' };
  }

  const nextStatus = EXECUTION_ORDER[action];
  const entry = {
    interestId: job.stylistInterests.find((interest) => interest.stylistAccountId === stylistAccountId)?.id ?? '',
    stylistAccountId,
    stylistName,
    status: nextStatus,
    reachedAt: action === 'reached_venue' ? now : (existing?.reachedAt ?? null),
    startedAt: action === 'start_work' ? now : (existing?.startedAt ?? null),
    completedAt: action === 'complete_work' ? now : (existing?.completedAt ?? null),
    remarks: remarks || existing?.remarks || '',
  };
  const stylistExecutions = existing
    ? job.stylistExecutions.map((item) => (item.stylistAccountId === stylistAccountId ? entry : item))
    : [...job.stylistExecutions, entry];

  const updated: EventJob = {
    ...job,
    stylistExecutions,
    updatedAt: now,
    activity: [
      activityEntry(stylistName, 'stylist', `stylist_${action}`, remarks || undefined),
      ...job.activity,
    ],
  };
  jobs[index] = updated;
  await writeAll(jobs);
  return { job: updated };
}

// ---- Step 10: Collection (post-event check-in) ---------------------------------

export type CollectionResult = { job?: EventJob; error?: string };

export async function submitCollectionCheck(jobId: string, items: CollectionItemCheck[], staffName: string): Promise<CollectionResult> {
  const jobs = await readAll();
  const index = jobs.findIndex((job) => job.id === jobId);
  if (index === -1) return { error: 'Job not found.' };
  const job = jobs[index];
  const stage = findStage(job, 'collection');
  if (!stage || (stage.status !== 'open' && stage.status !== 'in_progress')) {
    return { error: 'Collection is not open for this job yet.' };
  }
  if (items.some((item) => item.returnedQuantity === null || item.returnedQuantity < 0)) {
    return { error: 'Enter a returned quantity (0 or more) for every item.' };
  }

  const now = new Date().toISOString();
  // Collection only confirms what physically came back — it never writes to inventory
  // and never decides final client charges (those happen at Return QC / Booking Final
  // Check). See SUPABASE_CONNECTION_PENDING.md.
  let updated: EventJob = { ...job, collectionCheck: { items, completedAt: now, completedBy: staffName } };
  updated = setStage(updated, 'collection', { status: 'done', completedAt: now, completedBy: staffName });
  updated = setStage(updated, 'return_quality_check', { status: 'open', openedAt: now });
  await notifyDepartment(job.id, 'qc', `${job.id} — Collection complete, Return QC is ready.`);
  const missing = items.reduce(
    (sum, item) => sum + Math.max(item.sentQuantity - (item.returnedQuantity ?? 0), 0),
    0,
  );
  updated = {
    ...updated,
    updatedAt: now,
    activity: [
      activityEntry(
        staffName,
        'collection',
        'collection_completed',
        missing ? `${missing} item(s) not returned.` : 'Everything sent was returned.',
      ),
      ...updated.activity,
    ],
  };
  jobs[index] = updated;
  await writeAll(jobs);
  return { job: updated };
}

// ---- Step 11: Return QC (same QC work area, kept separate from pre-event QC) ---

export type ReturnQcResult = { job?: EventJob; error?: string };

export async function submitReturnQualityCheck(jobId: string, items: ReturnQcItemCheck[], staffName: string): Promise<ReturnQcResult> {
  const jobs = await readAll();
  const index = jobs.findIndex((job) => job.id === jobId);
  if (index === -1) return { error: 'Job not found.' };
  const job = jobs[index];
  const stage = findStage(job, 'return_quality_check');
  if (!stage || (stage.status !== 'open' && stage.status !== 'in_progress')) {
    return { error: 'Return QC is not open for this job yet.' };
  }
  if (items.some((item) => item.goodQuantity === null || item.damagedQuantity === null)) {
    return { error: 'Enter a good quantity and a damaged quantity for every item.' };
  }
  if (items.some((item) => (item.goodQuantity ?? 0) + (item.damagedQuantity ?? 0) > item.returnedQuantity)) {
    return { error: 'Good + damaged quantity cannot be more than the returned quantity.' };
  }

  const now = new Date().toISOString();
  // Return QC determines product condition only — it never decides client payment (that
  // stays with Booking Final Check) and it never overwrites the pre-event `qualityCheck`
  // record, which is kept as separate history.
  let updated: EventJob = { ...job, returnQualityCheck: { items, completedAt: now, completedBy: staffName } };
  updated = setStage(updated, 'return_quality_check', { status: 'done', completedAt: now, completedBy: staffName });
  updated = setStage(updated, 'return_warehouse', { status: 'open', openedAt: now });
  await notifyDepartment(job.id, 'warehouse', `${job.id} — Return QC complete, Return Warehouse is ready.`);
  const damaged = items.reduce((sum, item) => sum + (item.damagedQuantity ?? 0), 0);
  updated = {
    ...updated,
    updatedAt: now,
    activity: [
      activityEntry(
        staffName,
        'qc',
        'return_quality_check_completed',
        damaged ? `${damaged} item(s) came back damaged.` : 'Everything returned came back in good condition.',
      ),
      ...updated.activity,
    ],
  };
  jobs[index] = updated;
  await writeAll(jobs);
  return { job: updated };
}

// ---- Step 12: Return Warehouse + inventory disposition -------------------------

export type ReturnWarehouseResult = { job?: EventJob; error?: string };

export async function submitReturnWarehouseCheck(
  jobId: string,
  items: ReturnWarehouseItemResult[],
  staffName: string,
): Promise<ReturnWarehouseResult> {
  const jobs = await readAll();
  const index = jobs.findIndex((job) => job.id === jobId);
  if (index === -1) return { error: 'Job not found.' };
  const job = jobs[index];
  const stage = findStage(job, 'return_warehouse');
  if (!stage || (stage.status !== 'open' && stage.status !== 'in_progress')) {
    return { error: 'Return Warehouse is not open for this job yet.' };
  }

  const now = new Date().toISOString();
  // NOTE (mock-layer limitation, documented in SUPABASE_CONNECTION_PENDING.md): this
  // records the usable/damaged/missing split for admin visibility, but there is no real
  // inventory table in this project yet for any stage to write back to — so "not
  // automatically restocking the full sent quantity" is trivially true today. The real
  // backend phase must wire `items[].usableQuantity` into actual product stock, not the
  // full original quantity, per the user's explicit instruction.
  let updated: EventJob = { ...job, returnWarehouseCheck: { items, completedAt: now, completedBy: staffName } };
  updated = setStage(updated, 'return_warehouse', { status: 'done', completedAt: now, completedBy: staffName });
  updated = setStage(updated, 'booking_final_check', { status: 'open', openedAt: now });
  await notifyDepartment(job.id, 'booking', `${job.id} — Return Warehouse complete. Ready for Final Closure.`);
  updated = {
    ...updated,
    updatedAt: now,
    activity: [
      activityEntry(staffName, 'warehouse', 'return_warehouse_completed', 'Returned stock sorted into usable/damaged/missing.'),
      ...updated.activity,
    ],
  };
  jobs[index] = updated;
  await writeAll(jobs);
  return { job: updated };
}

// ---- Step 13: Booking Final Check + Close Event --------------------------------

export type CloseEventInput = {
  paymentComplete: boolean;
  depositSettled: boolean;
  damageLossAcknowledged: boolean;
  refundAmount: number;
  additionalPaymentAmount: number;
  notes: string;
};

export type CloseEventResult = { job?: EventJob; error?: string };

// Admin-only... no — BOOKING-department-only by construction: only ever imported from
// app/staff-portal/booking/actions.ts, never from any other department's actions file
// and never from the admin app/event-jobs/actions.ts. This is the ONLY function in the
// whole mock layer allowed to set `status: 'closed'` — every other stage-completion
// function above stops at marking its own stage `done`.
export async function closeEventJob(jobId: string, input: CloseEventInput, closedBy: string): Promise<CloseEventResult> {
  const jobs = await readAll();
  const index = jobs.findIndex((job) => job.id === jobId);
  if (index === -1) return { error: 'Job not found.' };
  const job = jobs[index];

  // Prevent accidental duplicate closure.
  if (job.status === 'closed') {
    return { error: 'This Event Job is already closed.' };
  }

  const requiredDoneStages: EventJobStageKey[] = [
    'warehouse_pick',
    'quality_check',
    'packing',
    ...(job.bookingType === 'rental'
      ? (['collection', 'return_quality_check', 'return_warehouse'] as EventJobStageKey[])
      : []),
  ];
  const incompleteStage = requiredDoneStages.find((key) => findStage(job, key)?.status !== 'done');
  if (incompleteStage) {
    return { error: `${STAGE_LABEL[incompleteStage]} must be completed before the event can be closed.` };
  }
  if (job.stylistsRequired) {
    const stylistStage = findStage(job, 'stylist_opportunity');
    const approvedCount = job.stylistInterests.filter((interest) => interest.status === 'approved').length;
    if (stylistStage?.status !== 'done' && approvedCount < job.stylistsRequiredCount) {
      return { error: 'Stylist assignment is not complete for this job yet.' };
    }
  }
  const bookingFinalCheckStage = findStage(job, 'booking_final_check');
  if (!bookingFinalCheckStage || (bookingFinalCheckStage.status !== 'open' && bookingFinalCheckStage.status !== 'in_progress')) {
    return { error: 'Booking Final Check is not open for this job yet.' };
  }
  const unresolvedIssue = job.issues.some((issue) => !issue.resolved);
  if (unresolvedIssue) {
    return { error: 'Resolve all open issues before closing the event.' };
  }
  if (!input.paymentComplete || !input.depositSettled || !input.damageLossAcknowledged) {
    return { error: 'Confirm payment, deposit and damage/loss acknowledgement before closing the event.' };
  }

  const now = new Date().toISOString();
  const bookingFinalCheck: BookingFinalCheck = {
    paymentComplete: input.paymentComplete,
    depositSettled: input.depositSettled,
    damageLossAcknowledged: input.damageLossAcknowledged,
    refundAmount: input.refundAmount,
    additionalPaymentAmount: input.additionalPaymentAmount,
    notes: input.notes,
    completedAt: now,
    completedBy: closedBy,
  };

  let updated: EventJob = {
    ...job,
    status: 'closed',
    closedAt: now,
    bookingFinalCheck,
  };
  updated = setStage(updated, 'booking_final_check', { status: 'done', completedAt: now, completedBy: closedBy });
  updated = {
    ...updated,
    updatedAt: now,
    activity: [
      activityEntry(closedBy, 'booking', 'event_job_closed', 'Event Job closed — all departments notified.'),
      ...updated.activity,
    ],
  };

  // Step 16: notify every department that touched this job, plus each approved stylist
  // individually (they're identified by account id; other roles are only identified by
  // a free-text name in this mock layer, so those go to their whole department instead
  // of a single person — still role/permission-appropriate, just coarser).
  const touchedDepartments = new Set<StaffDepartment>(['warehouse', 'qc', 'collection', 'booking']);
  for (const department of touchedDepartments) {
    await notifyDepartment(updated.id, department, `${updated.eventSummary.eventName} (${updated.id}) is now closed.`);
  }
  for (const interest of updated.stylistInterests) {
    if (interest.status === 'approved') {
      await notifyAccount(updated.id, interest.stylistAccountId, `${updated.eventSummary.eventName} (${updated.id}) is now closed. Thank you!`);
    }
  }

  // Step 17: performance credit — ONLY on a successful first close, guarded twice (the
  // `status === 'closed'` check above, and this flag) so the same event is never
  // counted more than once for the same participant.
  if (!updated.performanceCredited) {
    if (updated.warehousePrep?.completedBy) {
      await creditPerformance(`warehouse:${updated.warehousePrep.completedBy}`, updated.warehousePrep.completedBy, 'warehouse', updated.id);
    }
    if (updated.returnWarehouseCheck?.completedBy) {
      await creditPerformance(
        `warehouse:${updated.returnWarehouseCheck.completedBy}`,
        updated.returnWarehouseCheck.completedBy,
        'warehouse',
        updated.id,
      );
    }
    if (updated.qualityCheck?.completedBy) {
      await creditPerformance(`qc:${updated.qualityCheck.completedBy}`, updated.qualityCheck.completedBy, 'qc', updated.id);
    }
    if (updated.packingChecklist?.completedBy) {
      await creditPerformance(`qc:${updated.packingChecklist.completedBy}`, updated.packingChecklist.completedBy, 'qc', updated.id);
    }
    if (updated.returnQualityCheck?.completedBy) {
      await creditPerformance(`qc:${updated.returnQualityCheck.completedBy}`, updated.returnQualityCheck.completedBy, 'qc', updated.id);
    }
    if (updated.collectionCheck?.completedBy) {
      await creditPerformance(`collection:${updated.collectionCheck.completedBy}`, updated.collectionCheck.completedBy, 'collection', updated.id);
    }
    for (const interest of updated.stylistInterests) {
      if (interest.status === 'approved') {
        await creditPerformance(`stylist:${interest.stylistAccountId}`, interest.stylistName, 'stylist', updated.id);
      }
    }
    await creditPerformance(`booking:${closedBy}`, closedBy, 'booking', updated.id);
    updated = { ...updated, performanceCredited: true };
  }

  jobs[index] = updated;
  await writeAll(jobs);

  const admin = createAdminClient();
  const { data: booking, error: bookingError } = await admin
    .from('bookings')
    .select('owner_id,total,paid_amount')
    .eq('id', updated.bookingId)
    .single();
  if (bookingError || !booking) throw new Error(bookingError?.message ?? 'Booking not found.');
  if (input.additionalPaymentAmount > 0) {
    const { error: paymentError } = await admin.from('booking_payments').insert({
      owner_id: booking.owner_id,
      booking_id: updated.bookingId,
      amount: input.additionalPaymentAmount,
      payment_method: 'other',
      reference_number: `Final settlement ${updated.id}`,
      notes: input.notes || 'Recorded during Event Job closure',
    });
    if (paymentError) throw new Error(paymentError.message);
  }
  const adjustedPaid = Math.max(Number(booking.paid_amount) + input.additionalPaymentAmount - input.refundAmount, 0);
  const adjustedBalance = Math.max(Number(booking.total) - adjustedPaid, 0);
  const { error: statusError } = await admin.from('bookings').update({
    status: 'completed',
    paid_amount: adjustedPaid,
    balance_amount: adjustedBalance,
    payment_status: input.refundAmount > 0 && adjustedPaid === 0 ? 'refunded' : adjustedBalance === 0 ? 'paid' : adjustedPaid > 0 ? 'partial' : 'unpaid',
  }).eq('id', updated.bookingId);
  if (statusError) throw new Error(statusError.message);
  const { error: activityError } = await admin.from('booking_activity').insert({
    owner_id: booking.owner_id,
    booking_id: updated.bookingId,
    action: 'event_job_closed',
    details: { event_job_id: updated.id, additional_payment: input.additionalPaymentAmount, refund: input.refundAmount, closed_by: closedBy },
  });
  if (activityError) throw new Error(activityError.message);
  return { job: updated };
}

// ---- Step 14: Admin Master Event Job overview -----------------------------------

export type JobOverviewRow = { label: string; value: string; tone: 'done' | 'pending' | 'attention' | 'neutral' };

function stageTone(status: EventJob['stages'][number]['status']): JobOverviewRow['tone'] {
  if (status === 'done') return 'done';
  if (status === 'blocked') return 'attention';
  if (status === 'open' || status === 'in_progress') return 'pending';
  return 'neutral';
}

function stageValue(status: EventJob['stages'][number]['status']): string {
  if (status === 'done') return 'Completed';
  if (status === 'open') return 'Open';
  if (status === 'in_progress') return 'In progress';
  if (status === 'blocked') return 'Blocked';
  return 'Not started';
}

// Pure/no I/O — the "at a glance" summary for the admin Master Event Job page. Every
// row answers one of the questions in the Step 14 brief (where's the job, what's
// pending, are stylists assigned, is travel ready, can it close, etc).
export function buildJobOverview(job: EventJob): JobOverviewRow[] {
  const get = (key: EventJobStageKey) => findStage(job, key)?.status ?? 'not_started';
  const qcPackingStatus =
    get('quality_check') === 'done' && get('packing') === 'done'
      ? 'done'
      : get('quality_check') === 'not_started'
        ? 'not_started'
        : 'open';

  const rows: JobOverviewRow[] = [
    { label: 'Booking', value: 'Confirmed', tone: 'done' },
    { label: 'Warehouse', value: stageValue(get('warehouse_pick')), tone: stageTone(get('warehouse_pick')) },
    {
      label: 'QC & Packing',
      value: qcPackingStatus === 'done' ? 'Completed' : qcPackingStatus === 'not_started' ? 'Not started' : 'In progress',
      tone: qcPackingStatus === 'done' ? 'done' : qcPackingStatus === 'not_started' ? 'neutral' : 'pending',
    },
  ];

  if (job.stylistsRequired) {
    const approvedCount = job.stylistInterests.filter((interest) => interest.status === 'approved').length;
    rows.push({
      label: 'Stylist',
      value: `${approvedCount}/${job.stylistsRequiredCount} Assigned`,
      tone: approvedCount >= job.stylistsRequiredCount ? 'done' : 'pending',
    });
    const travelReady = job.travelPlans.some((plan) => plan.travelLegs.length > 0 || plan.accommodation);
    rows.push({
      label: 'Travel',
      value: approvedCount === 0 ? 'Not applicable yet' : travelReady ? 'Ready' : 'Pending',
      tone: approvedCount === 0 ? 'neutral' : travelReady ? 'done' : 'attention',
    });
  } else {
    rows.push({ label: 'Stylist', value: 'Not required', tone: 'neutral' });
  }

  rows.push({
    label: 'Event',
    value: get('collection') === 'not_started' ? 'Upcoming' : 'Completed',
    tone: get('collection') === 'not_started' ? 'pending' : 'done',
  });
  rows.push({ label: 'Collection', value: stageValue(get('collection')), tone: stageTone(get('collection')) });
  rows.push({ label: 'Return QC', value: stageValue(get('return_quality_check')), tone: stageTone(get('return_quality_check')) });
  rows.push({
    label: 'Return Warehouse',
    value: stageValue(get('return_warehouse')),
    tone: stageTone(get('return_warehouse')),
  });
  rows.push({
    label: 'Settlement',
    value: job.bookingFinalCheck?.paymentComplete ? 'Completed' : 'Pending',
    tone: job.bookingFinalCheck?.paymentComplete ? 'done' : 'pending',
  });
  rows.push({
    label: 'Final Closure',
    value: job.status === 'closed' ? 'Completed' : get('booking_final_check') === 'not_started' ? 'Not yet' : 'Pending',
    tone: job.status === 'closed' ? 'done' : 'pending',
  });

  return rows;
}

// True only when every gate closeEventJob() itself checks is satisfied — used to show
// (or hide) the Close Event button/state before the booking staff even opens the form.
export function canCloseEventJob(job: EventJob): boolean {
  if (job.status === 'closed') return false;
  const requiredDoneStages: EventJobStageKey[] = [
    'warehouse_pick',
    'quality_check',
    'packing',
    ...(job.bookingType === 'rental'
      ? (['collection', 'return_quality_check', 'return_warehouse'] as EventJobStageKey[])
      : []),
  ];
  if (requiredDoneStages.some((key) => findStage(job, key)?.status !== 'done')) return false;
  if (job.stylistsRequired) {
    const approvedCount = job.stylistInterests.filter((interest) => interest.status === 'approved').length;
    const stylistStage = findStage(job, 'stylist_opportunity');
    if (stylistStage?.status !== 'done' && approvedCount < job.stylistsRequiredCount) return false;
  }
  const bookingFinalCheckStage = findStage(job, 'booking_final_check');
  if (!bookingFinalCheckStage || (bookingFinalCheckStage.status !== 'open' && bookingFinalCheckStage.status !== 'in_progress')) {
    return false;
  }
  if (job.issues.some((issue) => !issue.resolved)) return false;
  return true;
}
