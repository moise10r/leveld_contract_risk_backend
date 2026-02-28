import { Injectable } from '@nestjs/common';
import { AnalysisRecord, AnalysisRepositoryPort } from '../../domain/contract/ports/analysis-repository.port';
import { ContractAnalysis } from '../../domain/contract/entities/contract-analysis.entity';

@Injectable()
export class InMemoryAnalysisRepository extends AnalysisRepositoryPort {
  private readonly store = new Map<string, AnalysisRecord>();
  private readonly hashIndex = new Map<string, string>(); // contentHash → analysisId

  save(record: AnalysisRecord): void {
    this.store.set(record.analysis.id, record);
    if (record.analysis.contentHash) {
      this.hashIndex.set(record.analysis.contentHash, record.analysis.id);
    }
  }

  findById(id: string): AnalysisRecord | undefined {
    return this.store.get(id);
  }

  findByContentHash(hash: string): AnalysisRecord | undefined {
    const id = this.hashIndex.get(hash);
    return id ? this.store.get(id) : undefined;
  }

  update(id: string, partial: Partial<ContractAnalysis>): void {
    const record = this.store.get(id);
    if (record) {
      this.store.set(id, {
        ...record,
        analysis: { ...record.analysis, ...partial },
      });
    }
  }
}
