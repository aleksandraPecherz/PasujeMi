import type { ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface FormFieldProps {
  id: string;
  name?: string;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  hint?: ReactNode;
  endContent?: ReactNode;
  autoFocus?: boolean;
}

export function FormField({
  id,
  name,
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  error,
  hint,
  endContent,
  autoFocus,
}: FormFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="text-foreground mb-2 block text-sm font-semibold">
        {label}
      </label>
      <div className="relative">
        <Input
          id={id}
          name={name ?? id}
          type={type}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
          }}
          placeholder={placeholder}
          autoFocus={autoFocus}
          aria-invalid={error ? true : undefined}
          className={cn(endContent && "pr-12")}
        />
        {endContent}
      </div>
      {error ? (
        <p className="text-destructive mt-2 flex items-center gap-1.5 text-sm">
          <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : (
        hint
      )}
    </div>
  );
}
