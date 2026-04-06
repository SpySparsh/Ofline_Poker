"use client";

// Chip denomination → color mapping
const CHIP_COLORS = {
  100:  { bg: "#f5f5f4", ring: "#a8a29e", text: "#1c1917", label: "stone" },   // White/Stone
  500:  { bg: "#dc2626", ring: "#991b1b", text: "#fef2f2", label: "red" },      // Red
  1000: { bg: "#2563eb", ring: "#1e40af", text: "#eff6ff", label: "blue" },     // Blue
  5000: { bg: "#111111", ring: "#52525b", text: "#fafafa", label: "black" },    // Black
};

const DENOMINATIONS = [100, 500, 1000, 5000];

/**
 * Uses a greedy algorithm (largest denomination first) to decompose
 * an amount into a map of { denomination: count }.
 */
function decomposeToChips(amount) {
  const chips = {};
  let remaining = amount;
  
  for (let i = DENOMINATIONS.length - 1; i >= 0; i--) {
    const denom = DENOMINATIONS[i];
    const count = Math.floor(remaining / denom);
    if (count > 0) {
      chips[denom] = count;
      remaining -= denom * count;
    }
  }
  // If there's a remainder below 100, assign it to a virtual "1" denomination
  // But for display purposes we'll just show "odd" chips as 100s
  if (remaining > 0) {
    chips[100] = (chips[100] || 0) + 1;
  }
  return chips;
}

/**
 * Renders a single chip icon.
 * size: "sm" (16px), "md" (28px), "lg" (40px)
 */
function SingleChip({ denomination, size = "md", count, onClick, interactive = false }) {
  const colors = CHIP_COLORS[denomination] || CHIP_COLORS[100];
  
  const sizes = {
    sm: { w: 18, h: 18, font: "7px", ringW: 1.5 },
    md: { w: 36, h: 36, font: "10px", ringW: 2 },
    lg: { w: 48, h: 48, font: "13px", ringW: 2.5 },
  };
  const s = sizes[size] || sizes.md;
  
  const formatted = denomination >= 1000 ? `${denomination / 1000}K` : denomination;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      className={`relative inline-flex items-center justify-center rounded-full select-none shrink-0 transition-all duration-150 ${
        interactive 
          ? "cursor-pointer hover:scale-110 active:scale-95 hover:brightness-125 shadow-md hover:shadow-lg" 
          : "cursor-default"
      }`}
      style={{
        width: s.w,
        height: s.w,
        backgroundColor: colors.bg,
        border: `${s.ringW}px dashed ${colors.ring}`,
        boxShadow: interactive ? `0 2px 8px ${colors.ring}40` : "none",
      }}
      title={`${denomination} chip`}
    >
      <span
        className="font-mono font-black leading-none"
        style={{ fontSize: s.font, color: colors.text }}
      >
        {formatted}
      </span>
      {/* Count badge */}
      {count && count > 1 && (
        <span 
          className="absolute -top-1 -right-1 min-w-[14px] h-[14px] flex items-center justify-center rounded-full bg-zinc-900 text-white font-mono font-bold border border-zinc-600 z-10"
          style={{ fontSize: "8px", lineHeight: "1", padding: "0 3px" }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

/**
 * Renders a miniature chip stack for a contribution amount.
 * Used inside PlayerCard contribution bubbles.
 */
function MiniChipStack({ amount }) {
  if (!amount || amount <= 0) return null;
  const chips = decomposeToChips(amount);
  
  return (
    <div className="flex items-center gap-0.5">
      {DENOMINATIONS.map(d => {
        if (!chips[d]) return null;
        return <SingleChip key={d} denomination={d} size="sm" count={chips[d]} />;
      })}
    </div>
  );
}

/**
 * Renders the interactive chip tray for the ActionPanel.
 * Players tap chips to increment their working bet.
 */
function ChipTray({ onAddChip, availableStack }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {DENOMINATIONS.map(d => (
        <SingleChip
          key={d}
          denomination={d}
          size="lg"
          interactive
          onClick={() => onAddChip(d)}
        />
      ))}
    </div>
  );
}

export { SingleChip, MiniChipStack, ChipTray, decomposeToChips, DENOMINATIONS, CHIP_COLORS };
