export const THEME_COLORS = {
  PRIMARY: "#A60212", // Crimson (primary institutional)
  PRIMARY_HOVER: "#85010E",
  ACCENT: "#F5AB29", // Amber (accent / attention)
  BACKGROUND: "#F3F4F6", // Solid neutral page background
  TEXT: "#3B0A0F", // Dark Maroon (text primary)
  TEXT_MUTED: "#6E2B32", // Soft Maroon (secondary text)
  SUPPORT: "#D97B1A", // Burnt Orange (operational support)
  CARD: "#FFFFFF", // Solid White (cards, modals)
  BORDER: "#9B8D88", // Visible solid panel border
  SIDEBAR: "#3B0A0F", // Dark Maroon navigation shell
  SIDEBAR_ACTIVE: "#4E1117", // Selected nav item
  SIDEBAR_HOVER: "#4E1117",
  DANGER_BG: "#FEE2E2", // Solid light red for alerts/missing
  DANGER_BORDER: "#FECACA",
  SUCCESS_BG: "#FFF4E0", // Kept within solid palette
} as const;

export type AssetStatus =
  | "IN_USE"
  | "IN_STORAGE"
  | "UNDER_REPAIR"
  | "MISSING"
  | "FOR_DISPOSAL"
  | "DISPOSED";

export interface StatusBadgeStyle {
  label: string;
  bg: string;
  border: string;
  text: string;
  dotColor: string;
}

export function getStatusBadgeStyle(status: string): StatusBadgeStyle {
  switch (status) {
    case "IN_USE":
      return {
        label: "In Active Use",
        bg: "badge-solid badge-green",
        border: "border-[#27633B]",
        text: "text-[#FFFFFF]",
        dotColor: "bg-[#FFFFFF]",
      };
    case "IN_STORAGE":
      return {
        label: "In Storage",
        bg: "badge-solid badge-slate",
        border: "border-[#455468]",
        text: "text-[#FFFFFF]",
        dotColor: "bg-[#FFFFFF]",
      };
    case "UNDER_REPAIR":
      return {
        label: "Under Repair",
        bg: "badge-solid badge-amber",
        border: "border-[#8A4B08]",
        text: "text-[#FFFFFF]",
        dotColor: "bg-[#FFFFFF]",
      };
    case "MISSING":
      return {
        label: "Missing / Lost",
        bg: "badge-solid badge-crimson",
        border: "border-[#A60212]",
        text: "text-[#FFFFFF]",
        dotColor: "bg-[#FFFFFF]",
      };
    case "FOR_DISPOSAL":
      return {
        label: "For Disposal",
        bg: "badge-solid badge-maroon",
        border: "border-[#6E1829]",
        text: "text-[#FFFFFF]",
        dotColor: "bg-[#FFFFFF]",
      };
    case "DISPOSED":
      return {
        label: "Disposed / Written Off",
        bg: "badge-solid badge-slate",
        border: "border-[#53515B]",
        text: "text-[#FFFFFF]",
        dotColor: "bg-[#FFFFFF]",
      };
    default:
      return {
        label: status || "Unknown",
        bg: "badge-solid badge-slate",
        border: "border-border",
        text: "text-[#3B0A0F]",
        dotColor: "bg-[#3B0A0F]",
      };
  }
}
