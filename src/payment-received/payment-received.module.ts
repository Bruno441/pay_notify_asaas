import { Module } from '@nestjs/common';
import { PaymentReceivedController } from './payment-received.controller';
import { PaymentReceivedService } from './payment-received.service';

@Module({
  controllers: [PaymentReceivedController],
  providers: [PaymentReceivedService]
})
export class PaymentReceivedModule {}
