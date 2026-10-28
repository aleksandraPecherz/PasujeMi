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
  /** A permanent hint under the field (e.g. the minimum length); tied to the input through aria-describedby. */
  hint?: string;
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
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div>
      <label htmlFor={id} className="text-foreground mb-2 block text-sm font-bold">
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
          aria-describedby={describedBy}
          className={cn(endContent && "pr-12")}
        />
        {endContent}
      </div>
      {error && (
        <p id={errorId} className="text-destructive mt-2 flex items-center gap-1.5 text-sm">
          <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
      {hint && (
        <p id={hintId} className="text-muted-foreground mt-2 text-sm">
          {hint}
        </p>
      )}
    </div>
  );
}
