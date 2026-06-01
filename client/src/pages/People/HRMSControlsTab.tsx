import { Building2, FileUp, Shield, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SectionCard } from '@/components/shared/SectionCard';
import type { EmployeeListItem } from '@/components/People/types';

type HRMSControlsTabProps = {
  selectedEmployees: EmployeeListItem[];
  onClearSelection: () => void;
  onOpenImport: () => void;
  onOpenEmployee: (id: string) => void;
};

export function HRMSControlsTab({ selectedEmployees, onClearSelection, onOpenImport, onOpenEmployee }: HRMSControlsTabProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <SectionCard title="Bulk import">
          <FileUp className="mb-4 size-5 text-cyan-200" />
          <p className="mb-4 text-sm text-muted-foreground">Upload and validate employee spreadsheets before creating records.</p>
          <Button onClick={onOpenImport}>Open import flow</Button>
        </SectionCard>
        <SectionCard title="Selected employees">
          <Users className="mb-4 size-5 text-cyan-200" />
          <p className="text-sm text-muted-foreground">Current bulk selection count</p>
          <p className="mt-3 text-3xl font-semibold text-foreground">{selectedEmployees.length}</p>
        </SectionCard>
        <SectionCard title="HRMS guardrails">
          <Shield className="mb-4 size-5 text-cyan-200" />
          <p className="text-sm text-muted-foreground">Write operations remain permission-gated. Read visibility stays scoped by caller hierarchy.</p>
        </SectionCard>
      </div>

      <div className="rounded-2xl border border-border bg-white/[0.03] p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="font-medium text-foreground">Bulk action staging</h3>
            <p className="text-sm text-muted-foreground">Use the employee selection from the table tab, then review the set here before taking HRMS actions.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" disabled={selectedEmployees.length === 0} onClick={onClearSelection}>Clear selection</Button>
            <Button variant="outline" disabled={selectedEmployees.length === 0} onClick={() => selectedEmployees[0] && onOpenEmployee(selectedEmployees[0].id)}>
              <Building2 className="size-4" />
              Open first selected
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {selectedEmployees.length > 0 ? (
            selectedEmployees.map((employee) => (
              <Badge key={employee.id} variant="muted">{employee.name}</Badge>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No employees selected yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
