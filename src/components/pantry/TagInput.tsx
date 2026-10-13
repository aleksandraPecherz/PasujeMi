import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { MAX_TAG_LENGTH, MAX_TAGS } from "@/lib/matching/limits";
import { cn } from "@/lib/utils";

interface TagInputProps {
  id: string;
  label: string;
  placeholder: string;
  tags: string[];
  /** Adds a tag; false when the caller skipped it (duplicate ignoring case, limits), so the text stays to edit. */
  onAdd: (tag: string) => boolean;
  onRemove: (tag: string) => void;
  tagClassName?: string;
}

export function TagInput({ id, label, placeholder, tags, onAdd, onRemove, tagClassName }: TagInputProps) {
  const [value, setValue] = useState("");
  const full = tags.length >= MAX_TAGS;

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter" || e.nativeEvent.isComposing) {
      return;
    }
    e.preventDefault();
    if (value.trim() === "") {
      return;
    }
    if (onAdd(value)) {
      setValue("");
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-blue-100/80">
        {label}
      </label>
      <Input
        id={id}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
        }}
        onKeyDown={handleKeyDown}
        maxLength={MAX_TAG_LENGTH}
        disabled={full}
        placeholder={full ? `Limit ${MAX_TAGS} produktów` : placeholder}
        aria-describedby={`${id}-hint`}
        enterKeyHint="enter"
        autoComplete="off"
        className="border-white/20 bg-white/10 text-white placeholder:text-white/40 focus-visible:ring-purple-400/60"
      />
      <p id={`${id}-hint`} className="sr-only">
        Wpisz produkt i naciśnij Enter, żeby go dodać.
      </p>
      {tags.length > 0 && (
        <ul aria-label={label} className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <li key={tag} className="max-w-full">
              <Badge
                variant="outline"
                className={cn("max-w-full gap-1 py-1 pr-1 text-sm whitespace-normal text-white", tagClassName)}
              >
                <span className="min-w-0 break-words">{tag}</span>
                <button
                  type="button"
                  onClick={() => {
                    onRemove(tag);
                  }}
                  aria-label={`Usuń ${tag}`}
                  className="rounded-full p-0.5 text-white/60 transition-colors hover:bg-white/20 hover:text-white focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:outline-none"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
