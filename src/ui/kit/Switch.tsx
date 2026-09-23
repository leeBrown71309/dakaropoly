interface SwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Read aloud by a screen reader; the row around the switch shows it. */
  label: string;
  disabled?: boolean;
  size?: "sm" | "md";
}

const TRACK: Record<NonNullable<SwitchProps["size"]>, { w: number; h: number; knob: number }> = {
  sm: { w: 32, h: 18, knob: 14 },
  md: { w: 38, h: 22, knob: 18 },
};

/**
 * An on/off setting, as a lever rather than a button.
 *
 * The settings used to be enamel buttons whose label was their state —
 * "Activés", "Coupé" — which left every one of them ambiguous: is that what
 * it is, or what pressing it will do? A switch answers that by position,
 * and teal on paper reads as "on" from across the table.
 */
export function Switch({ checked, onChange, label, disabled = false, size = "md" }: SwitchProps) {
  const { w, h, knob } = TRACK[size];
  const inset = (h - knob) / 2;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative shrink-0 rounded-full transition-[background,box-shadow] duration-200 disabled:cursor-not-allowed disabled:opacity-45"
      style={{
        width: w,
        height: h,
        background: checked
          ? "linear-gradient(180deg,#2b8a83,#1e6f6b)"
          : "linear-gradient(180deg,#b3a282,#cbbc9c)",
        boxShadow: checked
          ? "inset 0 1px 3px rgba(8,40,40,.55), 0 1px 0 rgba(255,255,255,.7)"
          : "inset 0 1px 3px rgba(60,42,18,.5), 0 1px 0 rgba(255,255,255,.7)",
      }}
    >
      <span
        className="absolute rounded-full transition-transform duration-200 ease-out"
        style={{
          top: inset,
          left: inset,
          width: knob,
          height: knob,
          transform: `translateX(${checked ? w - knob - inset * 2 : 0}px)`,
          background: "linear-gradient(180deg,#fbf3e0,#d8b36a)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,.85), 0 1px 3px rgba(60,40,15,.55)",
        }}
      />
    </button>
  );
}
