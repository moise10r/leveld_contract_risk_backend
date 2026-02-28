import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
  Sse,
  UploadedFile,
  UseInterceptors,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Observable, fromEvent, merge, of } from 'rxjs';
import { map, takeUntil } from 'rxjs/operators';
import { Response } from 'express';
import { AnalyzeContractUseCase } from '../../application/use-cases/analyze-contract.use-case';

@Controller('contract')
export class ContractController {
  constructor(private readonly analyzeUseCase: AnalyzeContractUseCase) {}

  @Post('analyze')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 20 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (file.mimetype !== 'application/pdf') {
          return cb(new Error('Only PDF files are accepted'), false);
        }
        cb(null, true);
      },
    }),
  )
  async analyzeContract(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('text') text: string | undefined,
    @Body('fileName') fileName: string | undefined,
  ) {
    if (!file && !text?.trim()) {
      return { error: 'Provide either a PDF file or contract text' };
    }

    const { analysisId } = await this.analyzeUseCase.submit({ file, text, fileName });
    return { analysisId };
  }

  @Sse('analysis/:id/stream')
  streamProgress(@Param('id') id: string): Observable<MessageEvent> {
    const subject = this.analyzeUseCase.getProgressStream(id);

    return subject.asObservable().pipe(
      map((event) => ({ data: JSON.stringify(event) } as MessageEvent)),
    );
  }

  @Get('analysis/:id')
  getAnalysis(@Param('id') id: string) {
    return this.analyzeUseCase.getResult(id);
  }
}
