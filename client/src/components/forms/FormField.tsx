import type { FieldValues, Path, UseFormRegister } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type FormFieldProps<T extends FieldValues> = {
  label: string;
  name: Path<T>;
  register: UseFormRegister<T>;
  error?: string | undefined;
  type?: string | undefined;
  textarea?: boolean;
  placeholder?: string | undefined;
};

export function FormField<T extends FieldValues>({ label, name, register, error, type = 'text', textarea, placeholder }: FormFieldProps<T>) {
  const inputProps = {
    id: name,
    placeholder,
    ...register(name)
  };

  return (
    <label className="grid gap-2 text-sm">
      <span className="font-medium text-foreground">{label}</span>
      {textarea ? <Textarea {...inputProps} /> : <Input type={type} {...inputProps} />}
      {error ? <span className="text-xs text-rose-300">{error}</span> : null}
    </label>
  );
}
