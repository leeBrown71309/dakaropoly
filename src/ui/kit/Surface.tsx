import type { HTMLAttributes, ReactNode } from "react";

type DivProps = HTMLAttributes<HTMLDivElement>;

/** A sheet of printed card stock. */
export function Card({ className = "", children, ...rest }: DivProps) {
  return (
    <div className={`mat-card mat-grain ${className}`} {...rest}>
      {children}
    </div>
  );
}

/** The lacquered wooden rail the controls are mounted on. */
export function Rail({ className = "", children, ...rest }: DivProps) {
  return (
    <div className={`mat-wood mat-grain ${className}`} {...rest}>
      {children}
    </div>
  );
}

/** Hairline brass rule, for separating registers inside a card. */
export function BrassRule({ className = "" }: { className?: string }) {
  return <div className={`rule-brass ${className}`} />;
}

/**
 * Engraved caption, printed directly on the card stock.
 * Used for every field name in the interface.
 */
export function Label({ className = "", children }: { className?: string; children: ReactNode }) {
  return <span className={`u-label text-ink-500 ${className}`}>{children}</span>;
}

/** Section heading set in the display serif. */
export function Heading({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <h2 className={`u-display text-ink-900 ${className}`}>{children}</h2>;
}
