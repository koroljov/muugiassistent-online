"use client";

export function PrintButton({ label = "Prindi vaade" }: { label?: string }) {
  return (
    <button className="print-hide" type="button" onClick={() => window.print()}>
      {label}
    </button>
  );
}
