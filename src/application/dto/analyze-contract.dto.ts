import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AnalyzeContractDto {
  @ApiPropertyOptional({ description: 'Raw contract text (max 200,000 chars). Provide either this or a PDF file.' })
  @IsOptional()
  @IsString()
  @MaxLength(200_000, { message: 'Text exceeds 200,000 character limit' })
  text?: string;

  @ApiPropertyOptional({ description: 'Display name for the contract (used when submitting raw text).' })
  // File is handled by Multer; present as a separate field on the controller
  fileName?: string;
}
