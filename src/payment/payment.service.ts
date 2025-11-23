import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { google } from 'googleapis';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PaymentReceivedService {
  private readonly logger = new Logger(PaymentReceivedService.name);
  private transporter: nodemailer.Transporter;
  private gmailEmail: string;
  private urlSearchClient: string = 'https://api-sandbox.asaas.com/v3/customers/';
  private acessToken: string;

  constructor(private readonly prisma: PrismaService) {
    this.gmailEmail = process.env.GMAIL_EMAIL ?? '';

    if (!this.gmailEmail) {
      throw new Error('GMAIL_EMAIL não está configurado no .env.');
    }

    this.acessToken = process.env.TOKEN_ASAAS ?? '';

    if (!this.acessToken) {
      throw new Error('TOKEN_ASAAS não está configurado no .env.');
    }

    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

    if (!this.gmailEmail || !clientId || !clientSecret || !refreshToken) {
      this.logger.error(
        'Credenciais do Gmail ou OAuth não configuradas corretamente no .env! O serviço de e-mail pode não funcionar.',
      );
      throw new Error(
        'Falha ao inicializar o serviço de e-mail: credenciais ausentes.',
      );
    }

    const OAuth2 = google.auth.OAuth2;
    const oauth2Client = new OAuth2(
      clientId,
      clientSecret,
      'https://developers.google.com/oauthplayground',
    );

    oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });

    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: this.gmailEmail,
        clientId: clientId,
        clientSecret: clientSecret,
        refreshToken: refreshToken,
      },
    });

    this.logger.log(
      'Serviço de E-mail (Gmail com OAuth2) inicializado e pronto para enviar.',
    );
  }

  async sendMail(
    to: string,
    subject: string,
    html: string,
    fromAliasEmail: string,
    fromAliasName?: string,
  ) {
    if (!this.transporter) {
      this.logger.error(
        'Transporter do Nodemailer não inicializado. Verifique as credenciais e a inicialização no construtor.',
      );
      throw new Error(
        'Serviço de e-mail não configurado corretamente ou falha na inicialização.',
      );
    }

    const mailOptions = {
      from: fromAliasName
        ? `"${fromAliasName}" <${fromAliasEmail}>`
        : fromAliasEmail,
      to: to,
      subject: subject,
      html: html,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(
        `E-mail enviado: ${info.messageId} para ${to} de ${mailOptions.from}`,
      );
      return info;
    } catch (error) {
      this.logger.error(
        `Erro ao enviar e-mail para ${to} de ${mailOptions.from}:`,
        error.message || error,
      );
      throw error;
    }
  }

  async getClientById(clientId: string) {
    const url = `${this.urlSearchClient}${clientId}`;
    const headers = {
      'Content-Type': 'application/json',
      access_token: this.acessToken,
    };

    try {
      const response = await axios.get(url, { headers });
      this.logger.log(`Cliente encontrado: ${JSON.stringify(response.data)}`);
      return response;
    } catch (error) {
      this.logger.error(
        `Erro ao buscar cliente com ID ${clientId}:`,
        error.response?.data || error.message || error,
      );
      throw error;
    }
  }

  async checkPaymentExists(asaasId: string) {
    return this.prisma.pagamento.findUnique({
      where: { asaas_id: asaasId },
    });
  }

  async processPaymentConfirmation(payload: any) {
    const asaasId = payload.payment.id;
    const externalReference = payload.payment.externalReference;
    const paymentValue = payload.payment.value;
    const paymentDate = new Date(payload.payment.confirmedDate || Date.now());
    const billingType = payload.payment.billingType;

    // 1. Verifica se já existe o pagamento (Idempotência técnica)
    const existingPayment = await this.checkPaymentExists(asaasId);
    if (existingPayment) {
      this.logger.log(
        `Pagamento ${asaasId} já processado anteriormente. Ignorando.`,
      );
      return { processed: true, message: 'Pagamento já processado.' };
    }

    // 2. Busca a Reserva (externalReference é id_reserva)
    let reserva: any = null;
    let clienteId: string | null = null;

    if (externalReference) {
      // Tenta achar Reserva
      reserva = await this.prisma.reserva.findUnique({
        where: { id_reserva: externalReference },
        include: { precificacao: true, cliente: true },
      });

      if (reserva) {
        clienteId = reserva.cliente_id;
        this.logger.log(`Reserva encontrada: ${reserva.id_reserva}`);
      }
    }

    if (!reserva || !clienteId) {
      this.logger.warn(
        `Nenhuma Reserva encontrada para externalReference: ${externalReference}.`,
      );
      return { processed: false, message: 'Reserva não encontrada no banco.' };
    }

    const precificacaoId = reserva.precificacao_id;

    if (!precificacaoId) {
         return { processed: false, message: 'Precificação não encontrada.' };
    }

    // 3. Atualiza o status na TB_PRECIFICACAO
    await this.prisma.precificacao.update({
      where: { id_precificacao: precificacaoId },
      data: { status_precificacao: 'confirmado' },
    });
    this.logger.log(`Status da precificação ${precificacaoId} atualizado para confirmado.`);

    // 4. Cria o registro na TB_PAGAMENTOS
    await this.prisma.pagamento.create({
      data: {
        cliente_id: clienteId,
        reserva_id: reserva.id_reserva,
        pacote_id: null,
        forma_pagamento: billingType,
        valor_total: paymentValue,
        data_pagamento: paymentDate,
        asaas_id: asaasId,
      },
    });
    this.logger.log(`Pagamento registrado na TB_PAGAMENTOS: ${asaasId}`);

    return { processed: true, message: 'Pagamento processado e atualizado.' };
  }
}
