import type { TagVariant } from "@/components/pantry/TagInput";
import { cn } from "@/lib/utils";
import type { PantrySection } from "@/types";

export const PANTRY_SECTIONS: {
  section: PantrySection;
  /** Heading of the section in the desktop panel and the accessible name of its field. */
  label: string;
  /** Short name on the phone tabs and in the summary counts ("3 mam", "7 stałych"). */
  tabLabel: string;
  summaryLabel: string;
  hint: string;
  placeholder: string;
  variant: TagVariant;
}[] = [
  {
    section: "have",
    label: "Mam w domu",
    tabLabel: "Mam",
    summaryLabel: "mam",
    hint: "Produkty, które masz teraz.",
    placeholder: "np. pomidor",
    variant: "have",
  },
  {
    section: "staple",
    label: "Produkty stałe",
    tabLabel: "Stałe",
    summaryLabel: "stałych",
    hint: "Zawsze w domu. Zapamiętamy je.",
    placeholder: "np. sól",
    variant: "staple",
  },
  {
    section: "exclude",
    label: "Wykluczam",
    tabLabel: "Wykluczam",
    summaryLabel: "wykluczam",
    hint: "Przepisy z nimi znikną z listy.",
    placeholder: "np. orzechy",
    variant: "exclude",
  },
];

const DOT_CLASS: Record<PantrySection, string> = {
  have: "bg-dot-have",
  staple: "bg-dot-staple",
  exclude: "bg-dot-exclude",
};

/** The colored dot that marks a pantry section; decorative, the text next to it carries the meaning. */
export function SectionDot({ section, className }: { section: PantrySection; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block size-2.5 shrink-0 rounded-full", DOT_CLASS[section], className)}
    />
  );
}

/** "1 produkt", "2 produkty", "5 produktów". */
export function productCount(count: number): string {
  const lastDigit = count % 10;
  const lastTwo = count % 100;
  if (count === 1) return "1 produkt";
  return lastDigit >= 2 && lastDigit <= 4 && !(lastTwo >= 12 && lastTwo <= 14)
    ? `${count} produkty`
    : `${count} produktów`;
}
