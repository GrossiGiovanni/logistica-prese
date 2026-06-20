"use client";

import { useFormStatus } from "react-dom";

/**
 * Pulsante di submit con eventuale conferma.
 * Va usato dentro un <form action={...}>.
 */
export function ConfirmButton({
  children,
  confirm,
  variant = "secondary",
  className,
}: {
  children: React.ReactNode;
  confirm?: string;
  variant?: "primary" | "secondary" | "danger";
  className?: string;
}) {
  const { pending } = useFormStatus();
  const base =
    variant === "primary"
      ? "btn-primary"
      : variant === "danger"
        ? "btn-danger"
        : "btn-secondary";

  return (
    <button
      type="submit"
      disabled={pending}
      className={`${base} ${className ?? ""}`}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) {
          e.preventDefault();
        }
      }}
    >
      {pending ? "Attendere..." : children}
    </button>
  );
}
