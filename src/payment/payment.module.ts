import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaymentReceivedController } from './payment.controller';
import { PaymentReceivedService } from './payment.service';

@Module({
  imports: [ConfigModule.forRoot()],
  controllers: [PaymentReceivedController],
  providers: [PaymentReceivedService]
})
export class PaymentReceivedModule {}
