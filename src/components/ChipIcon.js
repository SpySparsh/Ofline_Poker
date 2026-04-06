"use client";

// Chip denomination → color mapping
const CHIP_COLORS = {
  10:     { bg: "#e7e5e4", ring: "#a8a29e", text: "#1c1917" },  // Cream
  50:     { bg: "#ea580c", ring: "#9a3412", text: "#fff7ed" },  // Orange
  100:    { bg: "#f5f5f4", ring: "#a8a29e", text: "#1c1917" },  // White/Stone
  500:    { bg: "#dc2626", ring: "#991b1b", text: "#fef2f2" },  // Red
  1000:   { bg: "#2563eb", ring: "#1e40af", text: "#eff6ff" },  // Blue
  5000:   { bg: "#111111", ring: "#52525b", text: "#fafafa" },  // Black
  10000:  { bg: "#7c3aed", ring: "#5b21b6", text: "#f5f3ff" },  // Purple
  50000:  { bg: "#d97706", ring: "#92400e", text: "#fffbeb" },  // Gold
  100000: { bg: "#94a3b8", ring: "#475569", text: "#f8fafc" },  // Platinum
};

const DENOMINATIONS = [10, 50, 100, 500, 1000, 5000, 10000, 50000, 100000];

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
  return chips;
}

/**
 * Format chip label for display
 */
function formatChipLabel(denomination) {
  if (denomination >= 1000) {
    return `${denomination / 1000}K`;
  }
  return denomination.toString();
}

/**
 * Renders a single chip icon.
 * size: "sm" (16px), "md" (28px), "lg" (40px)
 */
function SingleChip({ denomination, size = "md", count, onClick, interactive = false, disabled = false }) {
  const colors = CHIP_COLORS[denomination] || CHIP_COLORS[100];
  
  const sizes = {
    sm: { w: 18, h: 18, font: "7px", ringW: 1.5 },
    md: { w: 36, h: 36, font: "10px", ringW: 2 },
    lg: { w: 48, h: 48, font: "13px", ringW: 2.5 },
  };
  const s = sizes[size] || sizes.md;
  
  const formatted = formatChipLabel(denomination);
  const isDisabled = disabled || !interactive;

  return (
    <button
      type="button"
      onClick={!disabled ? onClick : undefined}
      disabled={isDisabled}
      className={`relative inline-flex items-center justify-center rounded-full select-none shrink-0 transition-all duration-150 ${
        disabled
          ? "cursor-not-allowed opacity-40 grayscale"
          : interactive 
            ? "cursor-pointer hover:scale-110 active:scale-95 hover:brightness-125 shadow-md hover:shadow-lg" 
            : "cursor-default"
      }`}
      style={{
        width: s.w,
        height: s.w,
        backgroundColor: colors.bg,
        border: `${s.ringW}px dashed ${colors.ring}`,
        boxShadow: interactive && !disabled ? `0 2px 8px ${colors.ring}40` : "none",
      }}
      title={disabled ? `${denomination} — not enough chips` : `${denomination} chip`}
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
  
  // Only show up to 4 most significant denominations to avoid clutter
  const activeChips = DENOMINATIONS.filter(d => chips[d]).slice(-4);
  
  return (
    <div className="flex items-center gap-0.5">
      {activeChips.map(d => (
        <SingleChip key={d} denomination={d} size="sm" count={chips[d]} />
      ))}
    </div>
  );
}

/**
 * Renders the interactive chip tray for the ActionPanel.
 * Players tap chips to increment their working bet.
 * Chips above the player's remaining stack are greyed out.
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
          disabled={d > availableStack}
          onClick={() => onAddChip(d)}
        />
      ))}
    </div>
  );
}

export { SingleChip, MiniChipStack, ChipTray, decomposeToChips, DENOMINATIONS, CHIP_COLORS, formatChipLabel };
