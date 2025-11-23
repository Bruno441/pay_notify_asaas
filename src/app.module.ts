import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PaymentReceivedModule } from './payment/payment.module';
// import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PaymentReceivedModule], // PrismaModule removed to prevent deployment errors
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
