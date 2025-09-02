import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaymentReceivedController } from './payment-received.controller';
import { PaymentReceivedService } from './payment-received.service';

@Module({
  imports: [ConfigModule.forRoot()],
  controllers: [PaymentReceivedController],
  providers: [PaymentReceivedService]
})
export class PaymentReceivedModule {}
