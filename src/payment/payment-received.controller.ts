// src/webhook/asaas.controller.ts
import { Controller, Post, Body, HttpCode, HttpStatus, Headers, Logger, UnauthorizedException } from '@nestjs/common';
import { PaymentReceivedService } from './payment-received.service';

@Controller('payment-received') // Define a rota base para este controller
export class PaymentReceivedController {
  private readonly logger = new Logger(PaymentReceivedController.name);

  constructor(private readonly PaymentReceivedService: PaymentReceivedService,) {}

  @Post('payment') // Rota específica: POST /webhook/asaas/payment
  @HttpCode(HttpStatus.OK) // Asaas espera um status 200 OK
  async handlePaymentWebhook(
    @Body() payload: any,
    @Headers('asaas-webhook-token') asaasToken?: string, // Para verificação de segurança
  ) {
    this.logger.log('Novo webhook de pagamento recebido do Asaas:');
    this.logger.log(`Evento: ${payload.data.event}`);
    this.logger.log(`ID do pagamento: ${payload.data.payment.id}`);
    this.logger.log(`Valor: ${payload.data.payment.value}`);
    this.logger.log(`Cliente: ${payload.data.payment.customer}`);
    this.logger.log(`Status: ${payload.data.payment.status}`);
    this.logger.log(`Descrição: ${payload.data.payment.description}`);
    this.logger.log(`Forma de pagamento: ${payload.data.payment.billingType}`);

    const TokenSecreto = process.env.ASAAS_WEBHOOK_SECRET;
    if (!TokenSecreto || asaasToken !== TokenSecreto) {
      this.logger.warn('Token do webhook Asaas inválido ou ausente.');
      throw new UnauthorizedException('Token inválido');
    }

    const responseClient = await this.PaymentReceivedService.getClientById(payload.data.payment.customer);

    // --- LÓGICA DE PROCESSAMENTO ---
    if (
      payload.data.event === 'PAYMENT_RECEIVED' ||
      payload.data.event === 'PAYMENT_CONFIRMED'
    ) {
      this.logger.log(
        `Pagamento ID ${payload.data.payment.id} teve o evento: ${payload.data.event}`,
      );
      // Enviar e-mail de confirmação para o cliente
      try {
        const nomeDoCliente = responseClient.data.name;
        const emailDestinatario = responseClient.data.email; // Substitua pelo e-mail real do cliente se disponível no payload
        const valor = payload.data.payment.value;
        const descricao = payload.data.payment.description;
        const dataPagamento = payload.data.payment.confirmedDate;
        const aliasEmail = 'brunoferreiraj3@gmail.COM';
        const nomeDoAlias = 'Somando Sabores';

        await this.PaymentReceivedService.sendMail(
          emailDestinatario,
          'Confirmação de Reserva - Pagamento Recebido',
          `<h1>Olá, ${nomeDoCliente}!</h1>
          <p>Recebemos o pagamento da sua reserva.</p>
          <p><b>Descrição:</b> ${descricao}</p>
          <p><b>Valor:</b> R$ ${valor}</p>
          <p><b>Data da confirmação:</b> ${dataPagamento}</p>
          <p>Obrigado por reservar conosco!</p>
          <p>Atenciosamente,<br>${nomeDoAlias}</p>`,
          aliasEmail,
          nomeDoAlias,
        );
        this.logger.log(`E-mail de confirmação enviado para ${emailDestinatario}.`);
      } catch (error) {
        this.logger.error('Falha ao enviar e-mail de confirmação:', error.stack);
        return { message: 'Erro ao enviar e-mail de confirmação.', error: error.message };
      }
    } else {
      this.logger.log(`Evento recebido não esperado ou não tratado: ${payload.data.event}`);
    }

    // Responda com 200 OK para o Asaas saber que você recebeu.
    return { message: 'Webhook recebido com sucesso!' };
  }
}