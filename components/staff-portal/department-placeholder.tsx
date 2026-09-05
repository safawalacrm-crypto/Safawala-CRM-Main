import { ClipboardList } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { DashboardHeader } from '@/components/layout/dashboard-header';

export function DepartmentPlaceholder({
  title,
  subtitle,
  description,
}: {
  title: string;
  subtitle: string;
  description: string;
}) {
  return (
    <div className="mx-auto max-w-[1440px] space-y-6">
      <DashboardHeader title={title} subtitle={subtitle} />
      <Card className="border-border shadow-level-1">
        <CardContent className="grid min-h-72 place-items-center p-8 text-center">
          <div>
            <span className="mx-auto grid size-12 place-items-center rounded-full bg-accent text-primary">
              <ClipboardList />
            </span>
            <h3 className="mt-4 font-semibold">{title} work will appear here</h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
