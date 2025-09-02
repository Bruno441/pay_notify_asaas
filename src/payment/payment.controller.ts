// src/webhook/asaas.controller.ts
import { Controller, Post, Body, HttpCode, HttpStatus, Headers, Logger, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { PaymentReceivedService } from './payment.service';

@Controller('payment')
export class PaymentReceivedController {
  private readonly logger = new Logger(PaymentReceivedController.name);

  constructor(private readonly PaymentReceivedService: PaymentReceivedService,) { }
  /*
  PAYMENT_RECEIVED/PAYMENT_CONFIRMED
  PAYMENT_OVERDUE -> Pagamento Atrasado
  PAYMENT_FAILED -> Pagamento Falhou
  PAYMENT_REFUNDED -> Pagamento Reembolsado
  */

  @Post('payment-received')
  @HttpCode(HttpStatus.OK)
  async handlePaymentWebhook(
    @Body() payload: any,
    @Headers('asaas-webhook-token') asaasToken?: string,
  ) {
    const TokenSecreto = process.env.ASAAS_WEBHOOK_SECRET;
    if (!TokenSecreto || asaasToken !== TokenSecreto) {
      this.logger.warn('Token do webhook Asaas inválido ou ausente.');
      throw new UnauthorizedException('Token inválido');
    }

    const responseClient = await this.PaymentReceivedService.getClientById(payload.data.payment.customer);

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
        const aliasEmail = 'brunoferreiraj3@gmail.com';
        const nomeDoAlias = 'Somando Sabores';

        const logoUrl = 'https://raw.githubusercontent.com/Bruno441/pay_notify_asaas/refs/heads/main/assets/logo.png';
        const htmlContent = `
              <!DOCTYPE html>
              <html lang="pt-BR">
              <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Confirmação de Pagamento</title>
              </head>
              <body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: Arial, sans-serif;">
            <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
              <td style="padding: 20px 0;">
                  <table align="center" border="0" cellpadding="0" cellspacing="0" width="600" style="border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
                <tr>
                    <td align="center" style="padding: 40px 0 30px 0;">
                  <img src="${logoUrl}" alt="Logo da Empresa" width="150" style="display: block;" />
                    </td>
                </tr>
                <tr>
                    <td style="padding: 0 30px 20px 30px;">
                  <h2 style="color: #333333; margin: 0;">Olá, ${nomeDoCliente}!</h2>
                  <p style="color: #555555; font-size: 16px; line-height: 1.5;">
                      Recebemos a confirmação de pagamento para a sua reserva. Agradecemos a preferência!
                  </p>
                    </td>
                </tr>
                <tr>
                    <td style="padding: 0 30px 30px 30px;">
                  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border: 1px dashed #D3C5E5; background-color: #fdfcff; border-radius: 8px; padding: 20px;">
                      <tr>
                    <td style="color: #333333; font-size: 16px;">
                        <p style="margin: 0 0 10px 0;"><strong>Descrição:</strong><br>${descricao}</p>
                        <p style="margin: 0 0 10px 0;"><strong>Valor:</strong><br>R$ ${valor}</p>
                        <p style="margin: 0;"><strong>Data da confirmação:</strong><br>${dataPagamento}</p>
                    </td>
                      </tr>
                  </table>
                    </td>
                </tr>
                <tr>
                    <td style="padding: 0 30px 40px 30px; text-align: center;">
                  <p style="color: #555555; font-size: 16px; line-height: 1.5;">
                      Obrigado por reservar conosco!
                  </p>
                    </td>
                </tr>
                <tr>
                    <td bgcolor="#f4f4f4" style="padding: 30px; text-align: center;">
                  <p style="margin: 0; color: #888888; font-size: 14px;">
                      Atenciosamente,<br>
                      Equipe ${nomeDoAlias}
                  </p>
                    </td>
                </tr>
                  </table>
              </td>
                </tr>
            </table>
              </body>
              </html>
            `;

        await this.PaymentReceivedService.sendMail(
          emailDestinatario,
          'Confirmação de Reserva - Pagamento Recebido',
          htmlContent,
          aliasEmail,
          nomeDoAlias,
        );
      } catch (error) {
        this.logger.error('Falha ao enviar e-mail de confirmação:', error.stack);
        throw new BadRequestException({ message: 'Erro ao enviar e-mail de confirmação.', error: error.message });
      }
    } else {
      this.logger.log(`Evento recebido não esperado ou não tratado: ${payload.data.event}`);
    }
    return { message: 'Webhook recebido com sucesso!' };
  }
}