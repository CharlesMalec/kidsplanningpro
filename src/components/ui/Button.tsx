import { ButtonHTMLAttributes, forwardRef } from "react";


export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
variant?: "primary" | "secondary" | "ghost";
}


export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
({ className = "", variant = "primary", ...props }, ref) => {
const base = "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm transition active:translate-y-px disabled:opacity-50 disabled:pointer-events-none";
const variants: Record<string, string> = {
primary: "bg-brand-500 text-white shadow-soft hover:brightness-105",
secondary: "bg-white border shadow-soft hover:bg-gray-50",
ghost: "hover:bg-gray-100",
};
return (
<button ref={ref} className={`${base} ${variants[variant]} ${className}`} {...props} />
);
}
);
Button.displayName = "Button";