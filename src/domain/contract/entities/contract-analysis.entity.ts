import { RiskClause } from './risk-clause.entity';
import { RiskSeverity } from '../value-objects/risk-severity.vo';

export type AnalysisStatus = 'pending' | 'running' | 'complete' | 'failed';
export type SignalRecommendation = 'SIGN' | 'NEGOTIATE' | 'REJECT' | 'REVIEW';

export interface ContractSummary {
  overallRisk: RiskSeverity;
  executiveSummary: string;
  keyThemes: string[];
  criticalItems: Array<{ item: string; action: string }>;
  signalRecommendation: SignalRecommendation;
}

export interface ContractAnalysis {
  id: string;
  status: AnalysisStatus;
  fileName: string;
  contentHash?: string;
  createdAt: Date;
  completedAt?: Date;
  clauses: RiskClause[];
  summary?: ContractSummary;
  error?: string;
}

export function createContractAnalysis(id: string, fileName: string, contentHash?: string): ContractAnalysis {
  return {
    id,
    status: 'pending',
    fileName,
    contentHash,
    createdAt: new Date(),
    clauses: [],
  };
}
