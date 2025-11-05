import { InputHTMLAttributes, forwardRef } from "react";


export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
({ className = "", ...props }, ref) => (
<input
ref={ref}
className={`border rounded-2xl px-3 py-2 focus:outline-none focus:ring w-full ${className}`}
{...props}
/>
)
);
Input.displayName = "Input";