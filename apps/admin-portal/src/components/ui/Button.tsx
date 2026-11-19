import { clsx } from "clsx";
import { forwardRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";
import { Spinner } from "./feedback";

type Variant = "primary" | "ghost" | "text" | "danger" | "dark" | "inverse" | "outline";
type Size = "sm" | "md" | "lg";

const styles = (variant: Variant, size: Size, block?: boolean) =>
  clsx(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-colors disabled:cursor-not-allowed disabled:border-line disabled:bg-line-soft disabled:text-ink-muted",
    size === "sm" && "min-h-[36px] rounded-lg px-3 text-xs",
    size === "md" && "min-h-[44px] rounded-xl px-[18px] text-sm",
    size === "lg" && "min-h-[52px] rounded-[14px] px-6 text-[15px]",
    block && "w-full",
    variant === "primary" && "bg-brand text-brand-fg hover:brightness-95",
    variant === "dark" && "bg-ink text-white hover:bg-ink-2",
    variant === "ghost" && "border border-line-2 bg-white text-ink hover:bg-canvas",
    variant === "outline" && "border border-line text-ink hover:border-line-2 hover:bg-canvas",
    variant === "text" && "bg-transparent px-2.5 text-brand hover:bg-brand-soft",
    variant === "danger" && "bg-transparent px-3 text-danger hover:bg-danger-soft",
    variant === "inverse" && "bg-white text-ink hover:bg-white/90",
  );

type Common = { variant?: Variant; size?: Size; block?: boolean; icon?: ReactNode; loading?: boolean };

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & Common>(
  ({ variant = "primary", size = "md", block, icon, loading, className, children, disabled, type = "button", ...rest }, ref) => (
    <button ref={ref} type={type} className={clsx(styles(variant, size, block), className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <Spinner size={16} /> : icon}
      {children}
    </button>
  ),
);
Button.displayName = "Button";

export const ButtonLink = ({ variant = "primary", size = "md", block, icon, className, children, ...rest }: LinkProps & Common) => (
  <Link className={clsx(styles(variant, size, block), "no-underline", className)} {...rest}>
    {icon}
    {children}
  </Link>
);

export const ButtonAnchor = ({ variant = "primary", size = "md", block, icon, className, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & Common) => (
  <a className={clsx(styles(variant, size, block), "no-underline", className)} {...rest}>
    {icon}
    {children}
  </a>
);
