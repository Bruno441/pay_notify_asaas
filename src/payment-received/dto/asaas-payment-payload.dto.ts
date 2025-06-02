// src/webhook/dto/asaas-payment-payload.dto.ts
import { Type } from 'class-transformer';
import { IsString, IsObject, ValidateNested, IsNotEmpty } from 'class-validator';

// Define a estrutura esperada para o objeto 'payment'
// Esta é uma estrutura básica, você deve expandi-la conforme os campos que precisa
export class PaymentDetailsDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  object: string; // "payment"

  @IsString()
  status: string; // Ex: RECEIVED, CONFIRMED, OVERDUE

  // Adicione outros campos que você espera receber do Asaas
  // Ex: value, netValue, customer, billingType, paymentDate, etc.
  // @IsNumber()
  // value: number;

  // @IsString()
  // customer: string;
}

export class AsaasWebhookPayloadDto {
  @IsString()
  @IsNotEmpty()
  event: string; // Ex: PAYMENT_RECEIVED, PAYMENT_CONFIRMED

  @IsObject()
  @ValidateNested()
  @Type(() => PaymentDetailsDto)
  payment: PaymentDetailsDto;
}