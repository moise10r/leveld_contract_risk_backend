import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Sse,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AnalyzeContractUseCase } from '../../application/use-cases/analyze-contract.use-case';

@ApiTags('contract')
@Controller('contract')
export class ContractController {
  constructor(private readonly analyzeUseCase: AnalyzeContractUseCase) {}

  @Post('analyze')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
      fileFilter: (_req, file, cb) => {
        if (file.mimetype !== 'application/pdf') {
          return cb(new Error('Only PDF files are accepted'), false);
        }
        cb(null, true);
      },
    }),
  )
  @ApiOperation({
    summary: 'Submit a contract for analysis',
    description:
      'Accepts either a PDF file upload or pasted contract text. ' +
      'Immediately returns an `analysisId` — use it to subscribe to the SSE stream for real-time progress.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'PDF file (max 20 MB). Provide either this or `text`.',
        },
        text: {
          type: 'string',
          description: 'Raw contract text (max 200,000 chars). Provide either this or `file`.',
        },
        fileName: {
          type: 'string',
          description: 'Display name when submitting raw text (e.g. "my-contract.txt").',
        },
      },
    },
  })
  @ApiResponse({
    status: 202,
    description: 'Analysis accepted. Connect to the SSE stream with the returned `analysisId`.',
    schema: {
      type: 'object',
      properties: {
        analysisId: { type: 'string', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Neither a PDF file nor contract text was provided.' })
  async analyzeContract(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('text') text: string | undefined,
    @Body('fileName') fileName: string | undefined,
  ) {
    if (!file && !text?.trim()) {
      throw new BadRequestException('Provide either a PDF file or contract text');
    }

    const { analysisId } = await this.analyzeUseCase.submit({ file, text, fileName });
    return { analysisId };
  }

  @Sse('analysis/:id/stream')
  @ApiOperation({
    summary: 'Stream analysis progress (SSE)',
    description:
      'Server-Sent Events stream. Connect immediately after receiving `analysisId`. ' +
      'Emits `progress` events at each pipeline stage and a final `complete` or `error` event. ' +
      'Each event `data` field is a JSON-encoded object described below.',
  })
  @ApiParam({ name: 'id', description: 'Analysis ID returned by POST /contract/analyze' })
  @ApiResponse({
    status: 200,
    description: 'SSE stream. Each message `data` is a JSON string with the shape below.',
    schema: {
      type: 'object',
      properties: {
        event: { type: 'string', enum: ['progress', 'complete', 'error'] },
        stage: {
          type: 'string',
          enum: ['parsing', 'chunking', 'identifying', 'scoring', 'recommending', 'summarising', 'complete', 'error'],
        },
        progress: { type: 'number', example: 60, description: '0–100' },
        message: { type: 'string', example: 'Scoring clause risks…' },
        data: { type: 'object', description: 'Full ContractAnalysis — only on the `complete` event.' },
        error: { type: 'string', description: 'Error message — only on the `error` event.' },
      },
    },
  })
  streamProgress(@Param('id') id: string): Observable<MessageEvent> {
    const subject = this.analyzeUseCase.getProgressStream(id);

    return subject.asObservable().pipe(
      map((event) => ({ data: JSON.stringify(event) } as MessageEvent)),
    );
  }

  @Get('analysis/:id')
  @ApiOperation({
    summary: 'Fetch a completed analysis',
    description:
      'Returns the full analysis result. Use as a fallback if the SSE connection drops before the `complete` event.',
  })
  @ApiParam({ name: 'id', description: 'Analysis ID returned by POST /contract/analyze' })
  @ApiResponse({
    status: 200,
    description: 'The completed ContractAnalysis object.',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        status: { type: 'string', enum: ['pending', 'running', 'complete', 'failed'] },
        fileName: { type: 'string' },
        createdAt: { type: 'string', format: 'date-time' },
        completedAt: { type: 'string', format: 'date-time' },
        clauses: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              type: { type: 'string' },
              text: { type: 'string' },
              location: { type: 'string' },
              severity: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
              riskFactors: { type: 'array', items: { type: 'string' } },
              explanation: { type: 'string' },
              recommendation: { type: 'string' },
            },
          },
        },
        summary: {
          type: 'object',
          nullable: true,
          properties: {
            overallRisk: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
            executiveSummary: { type: 'string' },
            keyThemes: { type: 'array', items: { type: 'string' } },
            criticalItems: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  item: { type: 'string' },
                  action: { type: 'string' },
                },
              },
            },
            signalRecommendation: { type: 'string', enum: ['SIGN', 'NEGOTIATE', 'REJECT', 'REVIEW'] },
          },
        },
        error: { type: 'string', nullable: true },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Analysis not found.' })
  getAnalysis(@Param('id') id: string) {
    return this.analyzeUseCase.getResult(id);
  }
}
