import { HTMLAttributes } from "react";
export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
return <div className={`bg-white rounded-2xl shadow-soft border ${className}`} {...props} />;
}
export function CardHeader({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
return <div className={`px-5 pt-5 pb-3 border-b ${className}`} {...props} />;
}
export function CardContent({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
return <div className={`px-5 py-4 ${className}`} {...props} />;
}