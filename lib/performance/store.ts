import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';

export type PerformanceCreditRecord = {
  identifier: string;
  name: string;
  department: string;
  completedJobIds: string[];
};

export async function creditPerformance(identifier: string, name: string, department: string, jobId: string) {
  const admin = createAdminClient();
  const { error } = await admin.from('staff_performance_credits').upsert({
    identifier, name, department, event_job_id: jobId,
  }, { onConflict: 'identifier,event_job_id,department', ignoreDuplicates: true });
  if (error) throw new Error(error.message);
}

export async function listPerformanceCredits(): Promise<PerformanceCreditRecord[]> {
  const admin = createAdminClient();
  const { data, error } = await admin.from('staff_performance_credits').select('identifier,name,department,event_job_id');
  if (error) throw new Error(error.message);
  const map = new Map<string, PerformanceCreditRecord>();
  for (const row of data ?? []) {
    const identifier = String(row.identifier);
    const current = map.get(identifier) ?? { identifier, name: String(row.name), department: String(row.department), completedJobIds: [] };
    current.completedJobIds.push(String(row.event_job_id));
    map.set(identifier, current);
  }
  return [...map.values()].sort((a, b) => b.completedJobIds.length - a.completedJobIds.length);
}
