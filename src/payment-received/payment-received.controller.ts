// src/webhook/asaas.controller.ts
import { Controller, Post, Body, HttpCode, HttpStatus, Headers, Logger } from '@nestjs/common';
import { AsaasWebhookPayloadDto } from './dto/asaas-payment-payload.dto'
 // Certifique-se de que o caminho está correto

@Controller('payment-received') // Define a rota base para este controller
export class PaymentReceivedController {
  private readonly logger = new Logger(PaymentReceivedController.name);

  @Post('payment') // Rota específica: POST /webhook/asaas/payment
  @HttpCode(HttpStatus.OK) // Asaas espera um status 200 OK
  handlePaymentWebhook(
    @Body() payload: AsaasWebhookPayloadDto,
    @Headers('asaas-webhook-token') asaasToken?: string, // Para verificação de segurança
  ) {
    this.logger.log('Novo webhook de pagamento recebido do Asaas:');
    this.logger.log(payload);

    // --- ETAPA DE SEGURANÇA (IMPORTANTE!) ---
    // Verifique o 'asaas-webhook-token' aqui se você configurou um no painel do Asaas.
    // const NossoTokenSecretoConfiguradoNoAsaas = process.env.ASAAS_WEBHOOK_SECRET;
    // if (NossoTokenSecretoConfiguradoNoAsaas && asaasToken !== NossoTokenSecretoConfiguradoNoAsaas) {
    //   this.logger.warn('Token do webhook Asaas inválido ou ausente.');
    //   // Você pode retornar um HttpStatus.UNAUTHORIZED ou FORBIDDEN, mas para o Asaas
    //   // não processar novamente, um 200 OK ainda pode ser o esperado, e você apenas ignora o payload.
    //   // Consulte a documentação do Asaas sobre o comportamento esperado em caso de falha na autenticação.
    //   // Por enquanto, apenas logamos. Na prática, não processe o payload se o token for inválido.
    // }

    // --- LÓGICA DE PROCESSAMENTO ---
    // Aqui você processará o payload.
    // Por exemplo, verificar o payload.event e payload.payment.status
    // e tomar ações como salvar no banco, notificar usuários, etc.

    if (payload.event === 'PAYMENT_RECEIVED' || payload.event === 'PAYMENT_CONFIRMED') {
      this.logger.log(`Pagamento ID ${payload.payment.id} teve o evento: ${payload.event}`);
      // Adicione sua lógica específica aqui:
      // - Salvar no banco de dados
      // - Enviar uma notificação
      // - Etc.
    } else {
      this.logger.log(`Evento recebido não esperado ou não tratado: ${payload.event}`);
    }

    // Responda com 200 OK para o Asaas saber que você recebeu.
    // Se você não responder com 200, o Asaas pode tentar reenviar o webhook.
    return { message: 'Webhook recebido com sucesso!' };
  }
}