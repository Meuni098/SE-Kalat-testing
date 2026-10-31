export const THEME_COLORS = {
  PRIMARY: "#A60212", // Crimson (primary institutional)
  PRIMARY_HOVER: "#85010E",
  ACCENT: "#F5AB29", // Amber (accent / attention)
  BACKGROUND: "#FFF4E0", // Cream (base background)
  TEXT: "#3B0A0F", // Dark Maroon (text primary)
  TEXT_MUTED: "#6E2B32", // Soft Maroon (secondary text)
  SUPPORT: "#D97B1A", // Burnt Orange (operational support)
  CARD: "#FFFFFF", // Solid White (cards, modals)
  BORDER: "#EBD3B2", // Sand Border (solid 1px borders)
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
        bg: "bg-[#FFF4E0]",
        border: "border-[#D97B1A]",
        text: "text-[#3B0A0F]",
        dotColor: "bg-[#D97B1A]",
      };
    case "IN_STORAGE":
      return {
        label: "In Storage",
        bg: "bg-[#FFFFFF]",
        border: "border-[#EBD3B2]",
        text: "text-[#3B0A0F]",
        dotColor: "bg-[#F5AB29]",
      };
    case "UNDER_REPAIR":
      return {
        label: "Under Repair",
        bg: "bg-[#FFF4E0]",
        border: "border-[#F5AB29]",
        text: "text-[#D97B1A]",
        dotColor: "bg-[#F5AB29]",
      };
    case "MISSING":
      return {
        label: "Missing / Lost",
        bg: "bg-[#FEE2E2]",
        border: "border-[#FECACA]",
        text: "text-[#A60212]",
        dotColor: "bg-[#A60212]",
      };
    case "FOR_DISPOSAL":
      return {
        label: "For Disposal",
        bg: "bg-[#FFF4E0]",
        border: "border-[#A60212]",
        text: "text-[#A60212]",
        dotColor: "bg-[#A60212]",
      };
    case "DISPOSED":
      return {
        label: "Disposed / Written Off",
        bg: "bg-[#FFFFFF]",
        border: "border-[#EBD3B2]",
        text: "text-[#6E2B32]",
        dotColor: "bg-[#6E2B32]",
      };
    default:
      return {
        label: status || "Unknown",
        bg: "bg-[#FFFFFF]",
        border: "border-[#EBD3B2]",
        text: "text-[#3B0A0F]",
        dotColor: "bg-[#3B0A0F]",
      };
  }
}
