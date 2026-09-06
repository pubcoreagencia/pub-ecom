export type AudienceLevel = "L1" | "L2" | "L3" | "L4";

export interface AudienceStats {
  level: AudienceLevel;
  label: string;
  count: number;
  conversion_rate: string;
}

export const getAudienceFunnel = (): AudienceStats[] => [
  { level: "L1", label: "Page View", count: 184200, conversion_rate: "100%" },
  { level: "L2", label: "Add to Cart", count: 33890, conversion_rate: "18.4%" },
  { level: "L3", label: "Add Payment Info", count: 15120, conversion_rate: "8.2%" },
  { level: "L4", label: "Purchase", count: 6980, conversion_rate: "3.8%" },
];

export const createRemarketingSegment = (from: AudienceLevel, to: AudienceLevel) => {
  return `Targeting ${from} who did not reach ${to}`;
};
