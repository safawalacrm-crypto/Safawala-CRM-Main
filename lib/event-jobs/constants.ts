import type { StaffDepartment } from '@/lib/staff-portal/constants';

export const EVENT_JOB_STAGE_KEYS = [
  'warehouse_pick',
  'stylist_opportunity',
  'quality_check',
  'packing',
  'collection',
  'return_quality_check',
  'return_warehouse',
  'booking_final_check',
] as const;

export type EventJobStageKey = (typeof EVENT_JOB_STAGE_KEYS)[number];

export type EventJobStageStatus = 'not_started' | 'open' | 'in_progress' | 'done' | 'blocked';

// Which staff-portal department owns each stage. 'stylist_opportunity' is where any
// stylist can express interest; the admin-only approval step comes in a later build
// step and does not need its own department here.
export const STAGE_DEPARTMENT: Record<EventJobStageKey, StaffDepartment> = {
  warehouse_pick: 'warehouse',
  stylist_opportunity: 'stylist',
  quality_check: 'qc',
  packing: 'qc',
  collection: 'collection',
  return_quality_check: 'qc',
  return_warehouse: 'warehouse',
  booking_final_check: 'booking',
};

export const STAGE_LABEL: Record<EventJobStageKey, string> = {
  warehouse_pick: 'Warehouse pick',
  stylist_opportunity: 'Stylist opportunity',
  quality_check: 'Quality check',
  packing: 'Packing',
  collection: 'Collection',
  return_quality_check: 'Return QC',
  return_warehouse: 'Return warehouse',
  booking_final_check: 'Booking final check',
};

// Stages that open together the moment a Central Event Job is created — everything
// else starts 'not_started' until its predecessor stage completes.
export const INITIAL_OPEN_STAGES: EventJobStageKey[] = ['warehouse_pick', 'stylist_opportunity'];
