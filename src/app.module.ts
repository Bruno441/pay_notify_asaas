import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PaymentReceivedModule } from './payment/payment.module';
import { PaymentRefundedController } from './payment/payment-refunded.controller';
import { PaymentRefundedService } from './payment/payment-refunded.service';

@Module({
  imports: [PaymentReceivedModule],
  controllers: [AppController, PaymentRefundedController],
  providers: [AppService, PaymentRefundedService],
})
export class AppModule {}
