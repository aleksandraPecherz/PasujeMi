import { CircleAlert } from "lucide-react";

interface ServerErrorProps {
  message?: string | null;
}

export function ServerError({ message }: ServerErrorProps) {
  if (!message) return null;

  return (
    <p
      role="alert"
      className="bg-exclude text-destructive flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium"
    >
      <CircleAlert className="size-5 shrink-0" aria-hidden="true" />
      {message}
    </p>
  );
}
