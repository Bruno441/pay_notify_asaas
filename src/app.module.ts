import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PaymentReceivedModule } from './payment/payment-received.module';


@Module({
  imports: [PaymentReceivedModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
