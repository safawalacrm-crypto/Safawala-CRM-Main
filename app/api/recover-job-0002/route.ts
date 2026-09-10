import { NextResponse } from 'next/server';

// This was a TEMPORARY one-time diagnostic/recovery route used on 2026-09-10
// to fix an event-jobs data issue. It has done its job and is disabled here.
// The file couldn't be deleted automatically (no shell access to this
// machine in that session) -- it is safe to delete this whole folder.
export async function GET() {
  return NextResponse.json({ disabled: true }, { status: 410 });
}
export async function POST() {
  return NextResponse.json({ disabled: true }, { status: 410 });
}
