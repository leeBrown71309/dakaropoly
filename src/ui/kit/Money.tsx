const GROUPED = new Intl.NumberFormat("fr-FR");

interface MoneyProps {
  amount: number;
  /** Prefix positive values with a `+`, for gains and bids. */
  signed?: boolean;
  className?: string;
}

/**
 * Every figure in the game goes through here: tabular digits so columns of
 * money line up, and a de-emphasised currency mark so the number leads.
 */
export function Money({ amount, signed = false, className = "" }: MoneyProps) {
  const sign = signed && amount > 0 ? "+" : "";
  return (
    <span className={`u-money whitespace-nowrap ${className}`}>
      {sign}
      {GROUPED.format(amount)}
      <span className="ml-[0.18em] text-[0.72em] font-semibold opacity-55">F</span>
    </span>
  );
}
