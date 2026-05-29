// src/modules/recruitment/JobDialog.tsx
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { httpClient } from '@/services/api/http-client';
import { useQueryClient } from '@tanstack/react-query';

type JobDialogProps = {
  open: boolean;
  onClose: () => void;
  job?: any; // for edit
};

export function JobDialog({ open, onClose, job }: JobDialogProps) {
  const [form, setForm] = useState({
    title: job?.title || '',
    slug: job?.slug || '',
    description: job?.description || '',
    department: job?.department || '',
    location: job?.location || '',
    employmentType: job?.employmentType || 'FULL_TIME',
    status: job?.status || 'DRAFT',
    ...job
  });
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (job) {
        await httpClient.patch(`/jobs/${job.id}`, form);
      } else {
        await httpClient.post('/jobs', form);
      }
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this job?')) return;
    setLoading(true);
    try {
      await httpClient.delete(`/jobs/${job.id}`);
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{job ? 'Edit Job' : 'Create Job'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Title *</Label>
            <Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} required />
          </div>
          <div>
            <Label>Slug *</Label>
            <Input value={form.slug} onChange={e => setForm({...form, slug: e.target.value})} required />
          </div>
          <div>
            <Label>Description</Label>
            <textarea className="w-full border rounded p-2" rows={4} value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
          </div>
          <div>
            <Label>Department</Label>
            <Input value={form.department} onChange={e => setForm({...form, department: e.target.value})} />
          </div>
          <div>
            <Label>Location</Label>
            <Input value={form.location} onChange={e => setForm({...form, location: e.target.value})} />
          </div>
          <div>
            <Label>Employment Type</Label>
            <Select value={form.employmentType} onValueChange={v => setForm({...form, employmentType: v})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="FULL_TIME">Full Time</SelectItem>
                <SelectItem value="PART_TIME">Part Time</SelectItem>
                <SelectItem value="CONTRACT">Contract</SelectItem>
                <SelectItem value="INTERN">Intern</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={v => setForm({...form, status: v})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="PUBLISHED">Published</SelectItem>
                <SelectItem value="UNPUBLISHED">Unpublished</SelectItem>
                <SelectItem value="CLOSED">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-between">
            {job && (
              <Button type="button" variant="destructive" onClick={handleDelete} disabled={loading}>
                Delete
              </Button>
            )}
            <Button type="submit" disabled={loading}>Save</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}