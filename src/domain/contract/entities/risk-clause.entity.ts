import { ClauseType } from '../value-objects/clause-type.vo';
import { RiskSeverity } from '../value-objects/risk-severity.vo';

export interface RiskClause {
  id: string;
  title: string;
  type: ClauseType;
  text: string;
  location: string;
  severity: RiskSeverity;
  riskFactors: string[];
  explanation: string;
  recommendation: string;
}

export function createRiskClause(partial: Partial<RiskClause> & Pick<RiskClause, 'id' | 'title' | 'type' | 'text'>): RiskClause {
  return {
    location: '',
    severity: RiskSeverity.LOW,
    riskFactors: [],
    explanation: '',
    recommendation: '',
    ...partial,
  };
}
