import type { ButtonHTMLAttributes } from "react";
import { Icon, type IconName } from "../icons/Icon";

export type ButtonFace = "gold" | "teal" | "clay" | "bone" | "slate";
export type ButtonSize = "sm" | "md" | "lg";

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: "px-2.5 py-1.5 text-[11px] gap-1.5",
  md: "px-4 py-2.5 text-[13px] gap-2",
  lg: "px-6 py-3.5 text-[15px] gap-2.5",
};

const ICON_SIZE: Record<ButtonSize, number> = { sm: 13, md: 16, lg: 19 };

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  face?: ButtonFace;
  size?: ButtonSize;
  icon?: IconName;
  iconRight?: IconName;
  block?: boolean;
}

/** Enamel token with real thickness — it sinks into the rail when pressed. */
export function Button({
  face = "bone",
  size = "md",
  icon,
  iconRight,
  block = false,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      className={`btn btn-enamel face-${face} ${SIZE_CLASS[size]} ${block ? "w-full" : ""} ${className}`}
      {...rest}
    >
      {icon && <Icon name={icon} size={ICON_SIZE[size]} />}
      {children}
      {iconRight && <Icon name={iconRight} size={ICON_SIZE[size]} />}
    </button>
  );
}

interface FittingProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName;
  active?: boolean;
  label: string;
}

/** Icon-only brass fitting screwed onto the wooden rail. */
export function Fitting({ icon, active = false, label, className = "", ...rest }: FittingProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      data-active={active}
      className={`btn btn-fitting h-9 w-9 shrink-0 ${className}`}
      {...rest}
    >
      <Icon name={icon} size={17} />
    </button>
  );
}
