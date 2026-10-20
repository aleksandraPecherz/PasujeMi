import { cva, type VariantProps } from "class-variance-authority";

const bannerVariants = cva("border-b px-4 py-3 text-center text-sm [&_a]:font-semibold [&_a]:underline", {
  variants: {
    variant: {
      error: "border-destructive bg-destructive/10 text-destructive",
    },
  },
  defaultVariants: {
    variant: "error",
  },
});

type BannerVariant = VariantProps<typeof bannerVariants>["variant"];

export { bannerVariants, type BannerVariant };
