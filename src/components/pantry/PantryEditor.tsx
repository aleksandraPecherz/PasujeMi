import type { Ref } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { LimitNotice, SaveNotice } from "@/components/pantry/PantryStates";
import { PANTRY_SECTIONS, SectionDot, productCount } from "@/components/pantry/sections";
import { TagInput } from "@/components/pantry/TagInput";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PantryLists, PantrySection } from "@/types";

interface PantryEditorProps {
  /** The popover element: the caller opens it with `showPopover()` below `lg`. */
  ref?: Ref<HTMLElement>;
  lists: PantryLists;
  tab: PantrySection;
  onTabChange: (section: PantrySection) => void;
  onAdd: (section: PantrySection, tag: string) => boolean;
  onRemove: (section: PantrySection, tag: string) => void;
  onApply: () => void;
  onClose: () => void;
  loading: boolean;
  limitNotice: string | null;
  saveNotice: string | null;
}

/**
 * One editor for both layouts, so its fields, ids and typed text exist once. From `lg` CSS shows it as the side panel
 * (a closed popover is `display: none` only until `lg:block` says otherwise); below `lg` it is a bottom sheet that is a
 * popover: Esc and a click on the backdrop close it, and focus returns to the control that opened it.
 */
export function PantryEditor({
  ref,
  lists,
  tab,
  onTabChange,
  onAdd,
  onRemove,
  onApply,
  onClose,
  loading,
  limitNotice,
  saveNotice,
}: PantryEditorProps) {
  return (
    <section
      ref={ref}
      id="pantry-editor"
      popover="auto"
      aria-labelledby="pantry-editor-title"
      className={cn(
        "bg-card text-card-foreground backdrop:bg-foreground/40 border-0 p-0",
        "max-lg:fixed max-lg:inset-x-0 max-lg:top-auto max-lg:bottom-0 max-lg:m-0 max-lg:max-h-5/6 max-lg:w-full",
        "max-lg:overflow-y-auto max-lg:overscroll-contain max-lg:rounded-t-3xl max-lg:shadow-lg",
        "lg:static lg:m-0 lg:block lg:w-full lg:overflow-visible lg:rounded-2xl",
      )}
    >
      <div className="p-4 lg:p-5 lg:pb-4">
        <div className="mb-4 flex items-start justify-between gap-3 lg:mb-2">
          <div>
            <h2 id="pantry-editor-title" className="text-2xl font-extrabold lg:text-lg">
              Twoja spiżarka
            </h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Zamknij"
            className="lg:hidden"
          >
            <X aria-hidden="true" />
          </Button>
        </div>

        <div
          role="group"
          aria-label="Lista produktów"
          className="bg-secondary mb-5 grid grid-cols-3 gap-1 rounded-xl p-1 lg:hidden"
        >
          {PANTRY_SECTIONS.map(({ section, tabLabel }) => (
            <button
              key={section}
              type="button"
              aria-pressed={tab === section}
              onClick={() => {
                onTabChange(section);
              }}
              className={cn(
                "focus-visible:outline-ring flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-lg px-1 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2",
                tab === section ? "bg-card text-foreground" : "text-muted-foreground",
              )}
            >
              <span className="font-bold">{tabLabel}</span>
              <span className="flex items-center gap-1.5 text-xs font-medium">
                <SectionDot section={section} />
                {productCount(lists[section].length)}
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-5 lg:gap-3">
          {PANTRY_SECTIONS.map(({ section, label, hint, placeholder, variant }, i) => (
            <div
              key={section}
              className={cn(
                "flex flex-col gap-3 lg:gap-1.5",
                tab !== section && "max-lg:hidden",
                i > 0 && "lg:border-border lg:border-t lg:pt-3",
              )}
            >
              <h3 className="hidden items-center gap-2 text-lg font-bold lg:flex">
                <SectionDot section={section} />
                {label}
                <span className="text-muted-foreground text-base font-normal">· {lists[section].length}</span>
              </h3>
              <p className="text-muted-foreground">{hint}</p>
              <TagInput
                id={`pantry-${section}`}
                label={label}
                placeholder={placeholder}
                tags={lists[section]}
                onAdd={(tag) => onAdd(section, tag)}
                onRemove={(tag) => {
                  onRemove(section, tag);
                }}
                tagVariant={variant}
              />
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-2 empty:hidden">
          <LimitNotice message={limitNotice} />
          <SaveNotice message={saveNotice} />
        </div>
      </div>

      <div className="bg-card border-border sticky bottom-0 border-t p-4 lg:static lg:border-0 lg:p-5 lg:pt-0">
        <Button type="button" size="lg" onClick={onApply} disabled={loading} className="w-full">
          <SlidersHorizontal aria-hidden="true" />
          Zastosuj filtry
        </Button>
      </div>
    </section>
  );
}
