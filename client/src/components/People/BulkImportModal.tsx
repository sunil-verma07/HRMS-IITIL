import { useMutation } from '@tanstack/react-query';
import { FileUp, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { endpoints } from '@/services/api/endpoints';
import type { ApiEnvelope, ImportValidationResult } from './types';

type BulkImportModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
};

export function BulkImportModal({ open, onOpenChange, onImported }: BulkImportModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationResult, setValidationResult] = useState<ImportValidationResult | null>(null);

  const validateMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.post<ApiEnvelope<ImportValidationResult>>(endpoints.people.bulkImport, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return response.data.data;
    },
    onSuccess: (data) => {
      setValidationResult(data);
      toast.success('Import file validated');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to validate file');
    }
  });

  const confirmMutation = useMutation({
    mutationFn: async (rows: Array<Record<string, unknown>>) => {
      const response = await api.post<ApiEnvelope<{ createdCount: number; failures: Array<{ row: number; reason: string }> }>>(
        endpoints.people.bulkImportConfirm,
        { rows }
      );
      return response.data.data;
    },
    onSuccess: (data) => {
      toast.success(`Imported ${data.createdCount} people`);
      setSelectedFile(null);
      setValidationResult(null);
      onOpenChange(false);
      onImported();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to confirm import');
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Bulk Import</DialogTitle>
          <DialogDescription>Upload an XLSX file, validate its rows, and confirm the import transaction.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Input type="file" accept=".xlsx,.xls" onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)} />

          {validationResult ? (
            <div className="rounded-xl border border-border bg-white/[0.03] p-4 text-sm">
              <p className="text-muted-foreground">
                Total: {validationResult.summary.total} · Valid: {validationResult.summary.valid} · Invalid: {validationResult.summary.invalid}
              </p>
              {validationResult.invalid.length > 0 ? (
                <div className="mt-3 max-h-52 space-y-2 overflow-y-auto rounded-lg border border-border p-3">
                  {validationResult.invalid.map((row) => (
                    <p key={row.row} className="text-rose-300">Row {row.row}: {row.errors.join(', ')}</p>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => {
            setSelectedFile(null);
            setValidationResult(null);
            onOpenChange(false);
          }}>
            Cancel
          </Button>
          <Button variant="outline" disabled={!selectedFile || validateMutation.isPending} onClick={() => selectedFile && validateMutation.mutate(selectedFile)}>
            {validateMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
            Validate
          </Button>
          <Button disabled={!validationResult || validationResult.valid.length === 0 || confirmMutation.isPending} onClick={() => validationResult && confirmMutation.mutate(validationResult.valid)}>
            {confirmMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Confirm import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
