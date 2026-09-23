import type { CSSProperties, ReactNode } from "react";
import { useCompact } from "../../useViewport";
import { Icon, type IconName } from "../../icons/Icon";

/*
 * The grammar every settings tab is written in: a titled section, holding
 * rows, each row a name, a sentence and one control. The panel used to be a
 * single column of sliders, buttons and rules in whatever order they had
 * been added, and nothing said which of them belonged together — nor which
 * applied to this device and which to the whole room.
 */

interface SectionProps {
  title: string;
  icon: IconName;
  /** A small control on the heading line — "Par défaut", say. */
  action?: ReactNode;
  /** A sentence under the rows, for what applies to all of them. */
  note?: ReactNode;
  /**
   * No frame around the content, for content that brings its own — a grid
   * of cards framed a second time reads as a box of boxes.
   */
  bare?: boolean;
  children: ReactNode;
}

export function Section({ title, icon, action, note, bare = false, children }: SectionProps) {
  const compact = useCompact();
  return (
    <section className={compact ? "mb-3 last:mb-0" : "mb-5 last:mb-0"}>
      <header className={`flex min-h-6 items-center gap-1.5 px-0.5 ${compact ? "mb-1" : "mb-1.5"}`}>
        <Icon name={icon} size={compact ? 12 : 13} className="shrink-0 text-gold-700" />
        <h3 className="u-label text-ink-700">{title}</h3>
        {action && <div className="ml-auto">{action}</div>}
      </header>
      {bare ? (
        children
      ) : (
        <div
          className="divide-y divide-[rgba(110,86,52,.14)] rounded-[4px]"
          style={{
            background: "rgba(255,252,244,.62)",
            boxShadow: "inset 0 0 0 1px rgba(110,86,52,.2), 0 1px 0 rgba(255,255,255,.7)",
          }}
        >
          {children}
        </div>
      )}
      {note && (
        <p className={`px-0.5 leading-snug text-ink-500 ${compact ? "mt-1 text-[10.5px]" : "mt-1.5 text-[11.5px]"}`}>
          {note}
        </p>
      )}
    </section>
  );
}

interface RowProps {
  title: ReactNode;
  description?: ReactNode;
  /** The control, on the right. */
  children?: ReactNode;
  /** Dims the words as well as the control, for a setting that is locked. */
  muted?: boolean;
}

/** A name and a sentence on the left, the control on the right. */
export function Row({ title, description, children, muted = false }: RowProps) {
  const compact = useCompact();
  return (
    <div className={`flex items-center ${compact ? "gap-2 px-2.5 py-1.5" : "gap-3 px-3 py-2.5"}`}>
      <div className={`min-w-0 flex-1 ${muted ? "opacity-60" : ""}`}>
        <div className={`font-semibold leading-tight text-ink-900 ${compact ? "text-[12px]" : "text-[13px]"}`}>
          {title}
        </div>
        {description && (
          <div className={`leading-snug text-ink-500 ${compact ? "mt-0.5 text-[10.5px]" : "mt-0.5 text-[11.5px]"}`}>
            {description}
          </div>
        )}
      </div>
      {children && <div className="flex shrink-0 items-center gap-1.5">{children}</div>}
    </div>
  );
}

interface SliderRowProps {
  title: string;
  description?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
  /** Words at each end of the channel, so the direction is never a guess. */
  ends: [string, string];
  /**
   * Runs the channel backwards. "Vitesse" is stored as the time a hop takes,
   * where more is slower; drawn the natural way round, dragging towards
   * "faster" made the number go up and the tokens go slower.
   */
  inverted?: boolean;
  disabled?: boolean;
  /** Fired when the thumb is let go — to play a sample, say. */
  onCommit?: () => void;
}

export function SliderRow({
  title,
  description,
  value,
  min,
  max,
  step,
  format,
  onChange,
  ends,
  inverted = false,
  disabled = false,
  onCommit,
}: SliderRowProps) {
  const compact = useCompact();
  const shown = inverted ? max + min - value : value;
  const fill = ((shown - min) / (max - min)) * 100;

  return (
    <div className={compact ? "px-2.5 py-1.5" : "px-3 py-2.5"}>
      <div className="flex items-baseline gap-2">
        <span className={`font-semibold text-ink-900 ${compact ? "text-[12px]" : "text-[13px]"}`}>{title}</span>
        <span
          className={`u-money ml-auto rounded-[3px] px-1.5 py-0.5 font-bold text-ink-900 ${
            compact ? "text-[11px]" : "text-[12px]"
          }`}
          style={{ background: "rgba(205,161,88,.18)", boxShadow: "inset 0 0 0 1px rgba(168,112,31,.25)" }}
        >
          {format(value)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="u-label w-12 shrink-0 text-ink-300">{ends[0]}</span>
        <input
          type="range"
          className="range"
          aria-label={title}
          min={min}
          max={max}
          step={step}
          value={shown}
          disabled={disabled}
          style={{ "--fill": `${fill}%` } as CSSProperties}
          onChange={(e) => {
            const raw = Number(e.target.value);
            onChange(inverted ? max + min - raw : raw);
          }}
          onPointerUp={onCommit}
          onKeyUp={onCommit}
        />
        <span className="u-label w-12 shrink-0 text-right text-ink-300">{ends[1]}</span>
      </div>
      {description && (
        <p className={`leading-snug text-ink-500 ${compact ? "text-[10.5px]" : "text-[11.5px]"}`}>{description}</p>
      )}
    </div>
  );
}
