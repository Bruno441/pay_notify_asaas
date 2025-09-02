import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
<<<<<<< HEAD
import { PaymentReceivedModule } from './payment-received/payment-received.module';
=======
import { PaymentReceivedModule } from './payment/payment.module';
>>>>>>> e0d7d07 (subindo assets)

@Module({
  imports: [PaymentReceivedModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
