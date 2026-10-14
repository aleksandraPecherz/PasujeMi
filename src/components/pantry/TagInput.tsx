import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MAX_TAG_LENGTH, MAX_TAGS } from "@/lib/matching/limits";

export type TagVariant = "have" | "staple" | "exclude";

interface TagInputProps {
  id: string;
  label: string;
  placeholder: string;
  tags: string[];
  /** Adds a tag; false when the caller skipped it (duplicate ignoring case, limits), so the text stays to edit. */
  onAdd: (tag: string) => boolean;
  onRemove: (tag: string) => void;
  tagVariant: TagVariant;
}

export function TagInput({ id, label, placeholder, tags, onAdd, onRemove, tagVariant }: TagInputProps) {
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
      <label htmlFor={id} className="text-muted-foreground text-sm font-medium">
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
      />
      <p id={`${id}-hint`} className="sr-only">
        Wpisz produkt i naciśnij Enter, żeby go dodać.
      </p>
      {tags.length > 0 && (
        <ul aria-label={label} className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <li key={tag} className="max-w-full">
              <Badge variant={tagVariant} className="max-w-full gap-1 py-1 pr-1 text-sm whitespace-normal">
                <span className="min-w-0 break-words">{tag}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    onRemove(tag);
                  }}
                  aria-label={`Usuń ${tag}`}
                  className="size-5 rounded-full"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </Button>
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
