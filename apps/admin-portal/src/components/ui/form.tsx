import { clsx } from "clsx";
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

const control =
  "w-full rounded-xl border border-line-2 bg-white px-3.5 text-[14px] text-ink placeholder:text-ink-muted/70 focus:border-brand focus:outline focus:outline-[3px] focus:outline-brand/15 aria-[invalid=true]:border-danger";

export function Field({
  label,
  hint,
  error,
  children,
  className,
  htmlFor,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={clsx("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink-2">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-ink-muted">{hint}</p>}
      {error && (
        <p className="text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => (
  <input ref={ref} className={clsx(control, "min-h-[44px]", p.readOnly && "bg-[#F7F9FC] text-ink-3", className)} {...p} />
));
Input.displayName = "Input";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...p }, ref) => (
  <select ref={ref} className={clsx(control, "min-h-[44px]", className)} {...p} />
));
Select.displayName = "Select";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => (
  <textarea ref={ref} className={clsx(control, "py-2.5 leading-relaxed", className)} {...p} />
));
Textarea.displayName = "Textarea";

export const Checkbox = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; error?: string }>(
  ({ label, error, className, ...p }, ref) => {
    const id = useId();
    return (
      <div className={clsx("flex flex-col gap-1", className)}>
        <label htmlFor={id} className="flex items-start gap-3 text-sm leading-relaxed text-ink-2">
          <input ref={ref} id={id} type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-[rgb(var(--brand))]" {...p} />
          <span>{label}</span>
        </label>
        {error && (
          <p className="pl-7 text-xs font-medium text-danger" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  },
);
Checkbox.displayName = "Checkbox";
