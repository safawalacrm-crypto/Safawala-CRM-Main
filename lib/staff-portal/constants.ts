// Edge-safe constants for the Staff Portal (imported by middleware AND server code).
// Do not add Node-only imports (fs, next/headers, etc.) to this file.

export const STAFF_DEPARTMENTS = [
  'booking',
  'warehouse',
  'qc',
  'stylist',
  'collection',
  'modification',
] as const;

export type StaffDepartment = (typeof STAFF_DEPARTMENTS)[number];

export const DEPARTMENT_META: Record<
  StaffDepartment,
  { label: string; description: string; href: string }
> = {
  booking: {
    label: 'Booking',
    description: 'Create bookings, quotes and review event closures',
    href: '/staff-portal/booking',
  },
  warehouse: {
    label: 'Warehouse',
    description: 'Pick items and process returns',
    href: '/staff-portal/warehouse',
  },
  qc: {
    label: 'QC & Packing',
    description: 'Quality check, packing and return QC',
    href: '/staff-portal/qc',
  },
  stylist: {
    label: 'Stylist',
    description: 'Event opportunities and assignments',
    href: '/staff-portal/stylist',
  },
  collection: {
    label: 'Collection',
    description: 'Check items back in after the event',
    href: '/staff-portal/collection',
  },
  modification: {
    label: 'Modification',
    description: 'Alteration requests',
    href: '/staff-portal/modifications',
  },
};
