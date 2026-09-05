import { ClipboardList } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { STAGE_LABEL } from '@/lib/event-jobs/constants';
import { jobsForDepartment } from '@/lib/event-jobs/store';
import type { StaffDepartment } from '@/lib/staff-portal/constants';

// Reads the same Supabase-backed Central Event Jobs used by the admin portal.
export async function DepartmentJobList({ department }: { department: StaffDepartment }) {
  const entries = await jobsForDepartment(department);

  return (
    <Card className="border-border shadow-level-1">
      <CardHeader>
        <CardTitle>Jobs in your queue</CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length ? (
          <ul className="space-y-2">
            {entries.map(({ job, stages }) => (
              <li
                key={job.id}
                className="flex flex-col gap-1 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">
                    {job.id} <span className="text-xs text-muted-foreground">· {job.bookingNumber}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {stages.map((stage) => STAGE_LABEL[stage.key]).join(', ')}
                  </p>
                </div>
                <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
                  {stages[0]?.status.replace('_', ' ')}
                </Badge>
              </li>
            ))}
          </ul>
        ) : (
          <div className="grid min-h-32 place-items-center text-center">
            <div>
              <span className="mx-auto grid size-10 place-items-center rounded-full bg-accent text-primary">
                <ClipboardList className="size-5" />
              </span>
              <p className="mt-3 text-sm text-muted-foreground">No jobs waiting for your department right now.</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
