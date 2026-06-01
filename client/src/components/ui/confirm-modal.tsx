import { AlertTriangle, Info, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export type ConfirmModalProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

const variantStyles = {
  danger: {
    icon: <AlertTriangle className="size-10 text-rose-500" />,
    confirmClass:
      'bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-500',
  },
  warning: {
    icon: <AlertTriangle className="size-10 text-amber-500" />,
    confirmClass:
      'bg-amber-500 text-white hover:bg-amber-600 focus-visible:ring-amber-400',
  },
  info: {
    icon: <Info className="size-10 text-blue-500" />,
    confirmClass:
      'bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-500',
  },
} as const;

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  variant = 'danger',
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const { icon, confirmClass } = variantStyles[variant];

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen && !isLoading) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <div className="mb-2 flex justify-center">{icon}</div>
          <DialogTitle className="text-center">{title}</DialogTitle>
          <DialogDescription className="text-center">{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-2 flex-row justify-end gap-2 sm:flex-row">
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button
            className={confirmClass}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
