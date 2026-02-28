import { Module } from '@nestjs/common';
import { ContractModule } from './interfaces/http/contract.module';

@Module({
  imports: [ContractModule],
})
export class AppModule {}
