import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { google } from 'googleapis';
import axios from 'axios';

@Injectable()
export class PaymentReceivedService {
  private readonly logger = new Logger(PaymentReceivedService.name);
  private transporter: nodemailer.Transporter;
  private gmailEmail: string;
  private urlSearchClient: string =
    'https://api-sandbox.asaas.com/v3/customers/';
  private acessToken: string;
  private urlReservasApi: string =
    'https://somando-sabores-api.onrender.com/api/Reserva';

  constructor() {
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

  async getReservationsFromApi() {
    try {
      const response = await axios.get(this.urlReservasApi);
      return response.data; // { data: [...], message: "...", success: true }
    } catch (error) {
      this.logger.error(
        'Erro ao buscar reservas da API externa:',
        error.message || error,
      );
      throw new Error('Falha ao conectar com API de reservas.');
    }
  }

  async processPaymentConfirmation(payload: any) {
    // const asaasId = payload.payment.id;
    const externalReference = payload.payment.externalReference;
    // const paymentValue = payload.payment.value;
    // const paymentDate = new Date(payload.payment.confirmedDate || Date.now());
    // const billingType = payload.payment.billingType;

    // 1. Busca Reservas da API externa
    const apiResponse = await this.getReservationsFromApi();
    const reservas = apiResponse.data || [];

    // 2. Encontra a reserva pelo ID (externalReference)
    const reserva = reservas.find((r: any) => r.id === externalReference);

    if (!reserva) {
      this.logger.warn(
        `Reserva não encontrada na API externa para o ID: ${externalReference}`,
      );
      // Se não achou, não podemos confirmar status.
      // Retornamos sucesso para não travar o webhook, mas logamos aviso.
      return { processed: false, message: 'Reserva não encontrada na API.' };
    }

    this.logger.log(
      `Reserva encontrada na API: ${reserva.id}, Status: ${reserva.status}`,
    );

    // 3. Verifica Status
    // Status 1: Pagamento confirmado (já pago)
    // Status 0: Pendente (processar)
    if (reserva.status === 1) {
      this.logger.log(
        `Reserva ${externalReference} já está com status 1 (pago). Ignorando envio de e-mail.`,
      );
      return { processed: true, message: 'Pagamento já processado (API).' };
    }

    if (reserva.status === 0) {
      this.logger.log(
        `Reserva ${externalReference} está com status 0 (pendente). Prosseguindo com envio de e-mail.`,
      );
      // Aqui a lógica original prossegue (o controller chama sendMail depois que processPaymentConfirmation retorna).
      // Mas espere, o controller chama sendMail DEPOIS?
      // Vamos checar o controller. O controller chama processPaymentConfirmation E DEPOIS chama sendMail?
      // Não, o controller original chamava sendMail DENTRO do if/else.
      // O controller que eu refatorei chama processPaymentConfirmation E DEPOIS sendMail?
      // Vamos ver o controller.
      return {
        processed: true,
        message: 'Status verificado, e-mail será enviado.',
      };
    }

    return { processed: false, message: 'Status desconhecido.' };
  }
}
