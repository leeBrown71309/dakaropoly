export interface SegmentOption<T extends string | number> {
  value: T;
  label: string;
}

interface SegmentedProps<T extends string | number> {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Names the whole group for a screen reader. */
  label: string;
  disabled?: boolean;
  compact?: boolean;
}

/**
 * One choice among a handful, all of them visible at once.
 *
 * Used where a slider would lie about precision — a room timeout comes in
 * five sizes, not a continuum — and a menu would hide the alternatives the
 * player is actually weighing up.
 */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
  disabled = false,
  compact = false,
}: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled}
      className={`inline-flex max-w-full flex-wrap gap-0.5 rounded-[5px] p-0.5 ${disabled ? "opacity-55" : ""}`}
      style={{
        background: "linear-gradient(180deg,#e2d5bb,#efe6d2)",
        boxShadow: "inset 0 1px 3px rgba(80,60,30,.35), 0 1px 0 rgba(255,255,255,.7)",
      }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={`u-money rounded-[4px] font-bold transition-colors disabled:cursor-not-allowed ${
              compact ? "px-2 py-1 text-[11px]" : "px-2.5 py-1.5 text-[12px]"
            } ${selected ? "text-ink-900" : "text-ink-500 enabled:hover:text-ink-900"}`}
            style={
              selected
                ? {
                    background: "linear-gradient(180deg,#fffaf0,#efe3c8)",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,.9), 0 1px 3px rgba(60,40,15,.35)",
                  }
                : undefined
            }
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
