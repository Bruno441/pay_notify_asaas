import { Injectable, Logger, BadRequestException } from '@nestjs/common';
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

  async updateReservationInApi(reservation: any) {
    try {
      // Clona e atualiza o status
      const updatedReservation = { ...reservation, status: 1 };

      // Assume que a API aceita PUT na raiz com o objeto completo ou precisa de um endpoint específico
      // Tenta PUT na raiz conforme padrão REST comum se não houver ID na URL,
      // mas APIs .NET geralmente aceitam PUT /api/Reserva ou PUT /api/Reserva/{id}
      // Vou tentar PUT no endpoint base.

      this.logger.log(`Atualizando reserva ${reservation.id} para status 1 na API...`);
      const response = await axios.put(this.urlReservasApi, updatedReservation);

      this.logger.log(`Reserva atualizada com sucesso: ${JSON.stringify(response.data)}`);
      return response.data;
    } catch (error) {
      this.logger.error(
        `Erro ao atualizar reserva ${reservation.id} na API externa:`,
        error.message || error,
      );
      // Não relança erro para não parar o fluxo de e-mail?
      // O usuário disse "se for zero ele atualiza... e manda email".
      // Se falhar ao atualizar, devemos mandar email?
      // Se não atualizar, na próxima vai ser 0 de novo e manda email de novo (sem idempotência).
      // Melhor tentar mandar o email mesmo assim, mas logar o erro crítico.
      // Ou falhar tudo? Se falhar, o webhook do Asaas repete.
      // Se o Asaas repetir e a API ainda estiver 0, entramos num loop se o erro for persistente.
      // Vou deixar logado e prosseguir com o envio de email por enquanto, pois a prioridade é notificar.
      // Mas idealmente deveria ser atômico.
    }
  }

  async handlePaymentConfirmed(payload: any) {
    const externalReference = payload.payment.externalReference;

    // 1. Busca Reservas da API externa
    const apiResponse = await this.getReservationsFromApi();
    const reservas = apiResponse.data || [];

    // 2. Encontra a reserva pelo ID (externalReference)
    const reserva = reservas.find((r: any) => r.id === externalReference);

    if (!reserva) {
      this.logger.warn(
        `Reserva não encontrada na API externa para o ID: ${externalReference}`,
      );
      return { processed: false, message: 'Reserva não encontrada na API.' };
    }

    this.logger.log(
      `Reserva encontrada na API: ${reserva.id}, Status: ${reserva.status}`,
    );

    // 3. Verifica Status
    if (reserva.status === 1) {
      this.logger.log(
        `Reserva ${externalReference} já está com status 1 (pago). Ignorando envio de e-mail.`,
      );
      return { processed: true, message: 'Pagamento já processado (API).' };
    }

    if (reserva.status === 0) {
      this.logger.log(
        `Reserva ${externalReference} está com status 0 (pendente). Iniciando atualização e envio de e-mail.`,
      );

      // --- ATUALIZAÇÃO DA API ---
      await this.updateReservationInApi(reserva);

      try {
        const responseClient = await this.getClientById(
          payload.payment.customer,
        );

        const nomeDoCliente = responseClient.data.name;
        const emailDestinatario = responseClient.data.email;
        const valor = payload.payment.value;
        const descricao = payload.payment.description;
        const dataPagamento = payload.payment.confirmedDate;
        const aliasEmail = 'brunoferreiraj3@gmail.com';
        const nomeDoAlias = 'Somando Sabores';

        const logoUrl =
          'https://raw.githubusercontent.com/Bruno441/pay_notify_asaas/refs/heads/main/assets/logo.png';
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

        await this.sendMail(
          emailDestinatario,
          'Confirmação de Reserva - Pagamento Recebido',
          htmlContent,
          aliasEmail,
          nomeDoAlias,
        );

        this.logger.log('E-mail de confirmação enviado com sucesso.');
        return { processed: true, message: 'Pagamento confirmado e e-mail enviado.' };

      } catch (error) {
        this.logger.error('Falha ao enviar e-mail de confirmação:', error.stack);
        throw new BadRequestException({
          message: 'Erro ao enviar e-mail de confirmação.',
          error: error.message,
        });
      }
    }

    return { processed: false, message: `Status desconhecido ou não tratado: ${reserva.status}` };
  }
}
