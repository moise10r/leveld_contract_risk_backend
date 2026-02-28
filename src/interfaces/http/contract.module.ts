import { Module } from '@nestjs/common';
import { ContractController } from './contract.controller';
import { AnalyzeContractUseCase } from '../../application/use-cases/analyze-contract.use-case';
import { ContractAnalysisPipeline } from '../../infrastructure/ai/pipeline/contract-analysis.pipeline';
import { ChunkingStep } from '../../infrastructure/ai/pipeline/steps/chunking.step';
import { ClauseIdentificationStep } from '../../infrastructure/ai/pipeline/steps/clause-identification.step';
import { RiskScoringStep } from '../../infrastructure/ai/pipeline/steps/risk-scoring.step';
import { RecommendationStep } from '../../infrastructure/ai/pipeline/steps/recommendation.step';
import { SummaryStep } from '../../infrastructure/ai/pipeline/steps/summary.step';
import { aiClientProvider } from '../../infrastructure/ai/ai-client.factory';
import { PdfParserAdapter } from '../../infrastructure/pdf/pdf-parser.adapter';
import { InMemoryAnalysisRepository } from '../../infrastructure/persistence/in-memory-analysis.repository';
import { AnalysisRepositoryPort } from '../../domain/contract/ports/analysis-repository.port';

@Module({
  controllers: [ContractController],
  providers: [
    AnalyzeContractUseCase,
    ContractAnalysisPipeline,
    ChunkingStep,
    ClauseIdentificationStep,
    RiskScoringStep,
    RecommendationStep,
    SummaryStep,
    aiClientProvider,
    PdfParserAdapter,
    { provide: AnalysisRepositoryPort, useClass: InMemoryAnalysisRepository },
  ],
})
export class ContractModule {}
