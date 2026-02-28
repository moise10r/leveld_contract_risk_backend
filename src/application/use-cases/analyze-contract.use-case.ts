import { createHash } from 'crypto';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Subject } from 'rxjs';
import { v4 as uuid } from 'uuid';
import { AnalysisRepositoryPort } from '../../domain/contract/ports/analysis-repository.port';
import { ContractAnalysisPipeline, PipelineProgressEvent } from '../../infrastructure/ai/pipeline/contract-analysis.pipeline';
import { PdfParserAdapter } from '../../infrastructure/pdf/pdf-parser.adapter';
import { createContractAnalysis } from '../../domain/contract/entities/contract-analysis.entity';

export interface SubmitResult {
  analysisId: string;
}

@Injectable()
export class AnalyzeContractUseCase {
  private readonly logger = new Logger(AnalyzeContractUseCase.name);

  constructor(
    private readonly repository: AnalysisRepositoryPort,
    private readonly pipeline: ContractAnalysisPipeline,
    private readonly pdfParser: PdfParserAdapter,
  ) {}

  async submit(
    input: { text?: string; file?: Express.Multer.File; fileName?: string },
  ): Promise<SubmitResult> {
    const fileName = input.file?.originalname ?? input.fileName ?? 'contract.txt';

    // Compute a content hash to deduplicate identical documents
    const contentHash = createHash('sha256')
      .update(input.file ? input.file.buffer : Buffer.from(input.text ?? ''))
      .digest('hex');

    // Return the existing analysisId if the same document was already submitted
    const existing = this.repository.findByContentHash(contentHash);
    if (existing && existing.analysis.status !== 'failed') {
      this.logger.log(`Cache hit for content hash ${contentHash.slice(0, 8)}… — returning existing analysis ${existing.analysis.id}`);
      return { analysisId: existing.analysis.id };
    }

    const analysisId = uuid();
    const analysis = createContractAnalysis(analysisId, fileName, contentHash);
    const subject = new Subject<PipelineProgressEvent>();

    this.repository.save({ analysis, subject });

    // Kick off async — do not await
    this.runPipeline(analysisId, input, subject, fileName).catch((err) => {
      this.logger.error(`Pipeline error for ${analysisId}: ${err.message}`);
    });

    return { analysisId };
  }

  getProgressStream(analysisId: string): Subject<PipelineProgressEvent> {
    const record = this.repository.findById(analysisId);
    if (!record) throw new NotFoundException(`Analysis ${analysisId} not found`);
    return record.subject;
  }

  getResult(analysisId: string) {
    const record = this.repository.findById(analysisId);
    if (!record) throw new NotFoundException(`Analysis ${analysisId} not found`);
    return record.analysis;
  }

  private async runPipeline(
    analysisId: string,
    input: { text?: string; file?: Express.Multer.File },
    subject: Subject<PipelineProgressEvent>,
    fileName: string,
  ): Promise<void> {
    this.repository.update(analysisId, { status: 'running' });

    subject.next({
      event: 'progress',
      stage: 'parsing',
      progress: 5,
      message: 'Extracting document content…',
    });

    let text: string;

    try {
      if (input.file) {
        text = await this.pdfParser.extractText(input.file.buffer);
      } else if (input.text) {
        text = input.text.trim();
      } else {
        throw new Error('No content provided. Upload a PDF or paste contract text.');
      }

      if (text.length < 100) {
        throw new Error('Document is too short to analyse. Please provide a complete contract.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to extract document text';
      this.repository.update(analysisId, { status: 'failed', error: message });
      subject.next({ event: 'error', stage: 'parsing', progress: 0, message, error: message });
      subject.complete();
      return;
    }

    try {
      const result = await this.pipeline.run({ text, analysisId, fileName }, subject);
      this.repository.update(analysisId, { ...result, status: 'complete' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Pipeline failed';
      this.repository.update(analysisId, { status: 'failed', error: message });
      // Subject is already completed by the pipeline on error
    }
  }
}
