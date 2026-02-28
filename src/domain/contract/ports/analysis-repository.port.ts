import { Subject } from 'rxjs';
import { ContractAnalysis } from '../entities/contract-analysis.entity';

// Defined in the domain layer to prevent domain → infrastructure circular dependency
export interface PipelineProgressEvent {
  event: 'progress' | 'complete' | 'error';
  stage: string;
  progress: number;
  message: string;
  data?: ContractAnalysis;
  error?: string;
}

export interface AnalysisRecord {
  analysis: ContractAnalysis;
  subject: Subject<PipelineProgressEvent>;
}

export abstract class AnalysisRepositoryPort {
  abstract save(record: AnalysisRecord): void;
  abstract findById(id: string): AnalysisRecord | undefined;
  abstract findByContentHash(hash: string): AnalysisRecord | undefined;
  abstract update(id: string, partial: Partial<ContractAnalysis>): void;
}
