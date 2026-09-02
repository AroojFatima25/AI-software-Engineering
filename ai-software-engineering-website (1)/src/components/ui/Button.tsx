import { forwardRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/utils/cn";

type Variant = "primary" | "electric" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

const base =
  "group/btn relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium tracking-[-0.01em] transition-all duration-300 ease-out select-none focus-visible:ring-2 focus-visible:ring-electric/70 focus-visible:ring-offset-2 focus-visible:ring-offset-ink disabled:pointer-events-none disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary:
    "bg-snow text-ink hover:bg-white shadow-[0_0_0_1px_rgba(255,255,255,0.12),0_10px_32px_-10px_rgba(59,130,246,0.55)] hover:shadow-[0_0_0_1px_rgba(255,255,255,0.18),0_14px_44px_-10px_rgba(59,130,246,0.8)] hover:-translate-y-px",
  electric:
    "bg-electric text-white hover:bg-[#4b8ef7] shadow-[0_0_0_1px_rgba(59,130,246,0.4),0_10px_30px_-10px_rgba(59,130,246,0.8)] hover:shadow-[0_0_0_1px_rgba(125,180,255,0.5),0_14px_40px_-10px_rgba(59,130,246,0.95)] hover:-translate-y-px",
  secondary:
    "bg-white/[0.04] text-snow border border-white/10 backdrop-blur-sm hover:bg-white/[0.08] hover:border-white/20",
  ghost: "text-fog hover:text-snow",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-[13px]",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-[15px] sm:h-[52px] sm:px-7",
};

interface CommonProps {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}

type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };
type AnchorProps = CommonProps & AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

export type Props = ButtonProps | AnchorProps;

export const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, Props>(function Button(
  { variant = "primary", size = "md", className, children, ...rest },
  ref,
) {
  const classes = cn(base, variants[variant], sizes[size], className);

  if ("href" in rest && rest.href) {
    const anchorProps = rest as AnchorHTMLAttributes<HTMLAnchorElement>;
    return (
      <a ref={ref as React.Ref<HTMLAnchorElement>} className={classes} {...anchorProps}>
        {children}
      </a>
    );
  }

  const buttonProps = rest as ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button ref={ref as React.Ref<HTMLButtonElement>} type="button" className={classes} {...buttonProps}>
      {children}
    </button>
  );
});
