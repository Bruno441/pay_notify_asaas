// src/webhook/dto/asaas-payment-payload.dto.ts
import { Type } from 'class-transformer';
import { IsString, IsObject, ValidateNested, IsNotEmpty } from 'class-validator';

// Define a estrutura esperada para o objeto 'payment'
export class AsaasWebhookPayloadDto {
  id: string;
  event: string;
  dateCreated: string;
  payment: {
    object: string;
    id: string;
    dateCreated: string;
    customer: string;
    checkoutSession: string | null;
    paymentLink: string | null;
    value: number;
    netValue: number;
    originalValue: number | null;
    interestValue: number | null;
    description: string;
    billingType: string;
    confirmedDate: string;
    creditCard: {
      creditCardNumber: string;
      creditCardBrand: string;
      creditCardToken: string;
    } | null;
    pixTransaction: any | null;
    status: string;
    dueDate: string;
    originalDueDate: string;
    paymentDate: string | null;
    clientPaymentDate: string;
    installmentNumber: number | null;
    invoiceUrl: string;
    invoiceNumber: string;
    externalReference: string | null;
    deleted: boolean;
    anticipated: boolean;
    anticipable: boolean;
    creditDate: string;
    estimatedCreditDate: string;
    transactionReceiptUrl: string;
    nossoNumero: string;
    boletoUrl: string | null;
    lastInvoiceViewedDate: string;
    lastBankSlipViewedDate: string | null;
    discount: {
      value: number;
      limitDate: string | null;
      dueDateLimitDays: number;
      type: string;
    };
    fine: {
      value: number;
      type: string;
    };
    interest: {
      value: number;
      type: string;
    };
    postalService: boolean;
    custody: any | null;
    escrow: any | null;
    refunds: any | null;
  };
}