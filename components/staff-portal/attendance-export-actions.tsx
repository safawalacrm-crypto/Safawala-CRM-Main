'use client';

import { Download, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function AttendanceExportActions({ name, loginId, today }: { name: string; loginId: string; today: string }) {
  function exportCsv() {
    const csv = [['Field', 'Value'], ['Date', today], ['Staff account', name], ['Staff ID', loginId]]
      .map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `safawala-attendance-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={exportCsv}><Download />CSV</Button><Button variant="outline" onClick={() => window.print()}><FileText />PDF</Button></div>;
}
