import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AnalyzeContractDto {
  @IsOptional()
  @IsString()
  @MaxLength(200_000, { message: 'Text exceeds 200,000 character limit' })
  text?: string;

  // File is handled by Multer; present as a separate field on the controller
  fileName?: string;
}
