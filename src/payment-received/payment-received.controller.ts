// src/webhook/asaas.controller.ts
import { Controller, Post, Body, HttpCode, HttpStatus, Headers, Logger, UnauthorizedException, Get } from '@nestjs/common';
import { AsaasWebhookPayloadDto } from './dto/asaas-payment-payload.dto'
import { PaymentReceivedService } from './payment-received.service';
 // Certifique-se de que o caminho está correto

@Controller('payment-received') // Define a rota base para este controller
export class PaymentReceivedController {
  private readonly logger = new Logger(PaymentReceivedController.name);

  constructor(private readonly emailService: PaymentReceivedService,) {}

@Get('enviar')
  async enviarEmailDeTeste() {
    this.logger.log('Requisição para enviar e-mail de teste recebida...');
    try {
      const aliasEmail = 'brunoferreiraj3@gmail.COM'; // <<< SUBSTITUA AQUI
      const nomeDoAlias = 'Somando Sabores';    // <<< SUBSTITUA AQUI (opcional)
      const emailDestinatario = 'assede205@gmail.COM'; // <<< SUBSTITUA AQUI

      if (aliasEmail as string === 'SEU_ALIAS_VERIFICADO@EXEMPLO.COM' || emailDestinatario as string === 'EMAIL_PARA_ONDE_ENVIAR_O_TESTE@EXEMPLO.COM') {
        this.logger.warn('Por favor, substitua os e-mails de alias e destinatário no controller de teste.');
        return { message: 'Configure os e-mails no controller de teste primeiro!' };
      }

      await this.emailService.sendMail(
        emailDestinatario,
        'E-mail de Teste via NestJS e Gmail Alias',
        `<h1>Olá!</h1>
         <p>Este é um e-mail de teste enviado a partir da sua aplicação NestJS usando o serviço de e-mail que você configurou.</p>
         <p>Enviado em nome de: <span class="math-inline">${nomeDoAlias} &lt;</span>${aliasEmail}&gt;</p>
         <p>Horário: ${new Date().toLocaleString()}</p>`,
        aliasEmail,
        nomeDoAlias,
      );
      this.logger.log(`Tentativa de envio de e-mail para ${emailDestinatario} concluída.`);
      return { message: `E-mail de teste enviado para ${emailDestinatario}! Verifique a caixa de entrada e spam.` };
    } catch (error) {
      this.logger.error('Falha ao enviar e-mail de teste:', error.stack);
      return { message: 'Erro ao enviar e-mail de teste.', error: error.message };
    }
  }
  
  @Post('payment') // Rota específica: POST /webhook/asaas/payment
  @HttpCode(HttpStatus.OK) // Asaas espera um status 200 OK
handlePaymentWebhook(
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

    // --- ETAPA DE SEGURANÇA (IMPORTANTE!) ---
    // Verifique o 'asaas-webhook-token' aqui se você configurou um no painel do Asaas.
    const TokenSecreto = process.env.ASAAS_WEBHOOK_SECRET;
    if (!TokenSecreto || asaasToken !== TokenSecreto) {
      this.logger.warn('Token do webhook Asaas inválido ou ausente.');
      throw new UnauthorizedException('Token inválido');
    }

    // --- LÓGICA DE PROCESSAMENTO ---
    if (payload.event === 'PAYMENT_RECEIVED' || payload.event === 'PAYMENT_CONFIRMED') {
      this.logger.log(`Pagamento ID ${payload.data.payment.id} teve o evento: ${payload.data.event}`);
      // Adicione sua lógica específica aqui:
      // - Salvar no banco de dados
      // - Enviar uma notificação
      // - Etc.
    } else {
      this.logger.log(`Evento recebido não esperado ou não tratado: ${payload.event}`);
    }

    // Responda com 200 OK para o Asaas saber que você recebeu.
    return { message: 'Webhook recebido com sucesso!' };
  }
}