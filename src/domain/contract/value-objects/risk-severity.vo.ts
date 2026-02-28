export enum RiskSeverity {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

export const SEVERITY_WEIGHTS: Record<RiskSeverity, number> = {
  [RiskSeverity.HIGH]: 3,
  [RiskSeverity.MEDIUM]: 2,
  [RiskSeverity.LOW]: 1,
};

export function normaliseSeverity(raw: string): RiskSeverity {
  const upper = (raw ?? '').toUpperCase();
  if (upper === RiskSeverity.HIGH) return RiskSeverity.HIGH;
  if (upper === RiskSeverity.MEDIUM) return RiskSeverity.MEDIUM;
  return RiskSeverity.LOW;
}

export function computeOverallSeverity(severities: RiskSeverity[]): RiskSeverity {
  if (severities.length === 0) return RiskSeverity.LOW;

  const highCount = severities.filter((s) => s === RiskSeverity.HIGH).length;
  const mediumCount = severities.filter((s) => s === RiskSeverity.MEDIUM).length;

  if (highCount >= 1) return RiskSeverity.HIGH;
  if (mediumCount >= 2) return RiskSeverity.MEDIUM;
  if (mediumCount >= 1) return RiskSeverity.MEDIUM;
  return RiskSeverity.LOW;
}
