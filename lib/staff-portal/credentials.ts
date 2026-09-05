const STAFF_LOGIN_ID_PATTERN = /^[a-z0-9._-]+$/;

export function normalizeStaffLoginId(value: string) {
  return value.trim().toLowerCase();
}

export function isValidStaffLoginId(value: string) {
  return STAFF_LOGIN_ID_PATTERN.test(normalizeStaffLoginId(value));
}

export function staffAuthEmail(value: string) {
  const loginId = normalizeStaffLoginId(value);
  if (!STAFF_LOGIN_ID_PATTERN.test(loginId)) {
    throw new Error('Use letters, numbers, dots, hyphens or underscores in the Login ID.');
  }
  return `${loginId}@staff.safawala.internal`;
}
