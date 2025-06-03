import { Injectable, Logger } from '@nestjs/common'; // Logger importado
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { google } from 'googleapis';

@Injectable()
export class PaymentReceivedService { // Ou EmailService, se for mais apropriado
    private readonly logger = new Logger(PaymentReceivedService.name); // Nome do logger corrigido
    private transporter: nodemailer.Transporter;
    private gmailEmail: string;

    constructor(private readonly configService: ConfigService) {
        this.gmailEmail = this.configService.get<string>('GMAIL_EMAIL') ?? '';
        if (!this.gmailEmail) {
            throw new Error('GMAIL_EMAIL não está configurado no .env.');
        }
        const clientId = this.configService.get<string>('GOOGLE_OAUTH_CLIENT_ID');
        const clientSecret = this.configService.get<string>('GOOGLE_OAUTH_CLIENT_SECRET');
        const refreshToken = this.configService.get<string>('GOOGLE_OAUTH_REFRESH_TOKEN');

        if (!this.gmailEmail || !clientId || !clientSecret || !refreshToken) {
            this.logger.error('Credenciais do Gmail ou OAuth não configuradas corretamente no .env! O serviço de e-mail pode não funcionar.');
            // Você pode optar por lançar um erro aqui se o envio de e-mail for crítico:
            // throw new Error('Falha ao inicializar o serviço de e-mail: credenciais ausentes.');
            return; // Importante: Se retornar aqui, o transporter não será configurado.
                    // Considere se este é o comportamento desejado ou se deve lançar um erro.
        }

        // A LÓGICA DE CONFIGURAÇÃO DO TRANSPORTER FOI MOVIDA PARA FORA DO IF ANTERIOR
        const OAuth2 = google.auth.OAuth2;
        const oauth2Client = new OAuth2(
            clientId,
            clientSecret,
            'https://developers.google.com/oauthplayground', // URI de redirecionamento (pode ser qualquer um dos seus URIs configurados)
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
                // accessToken: await oauth2Client.getAccessToken(), // Nodemailer >6.3.0 geralmente lida com isso
            },
        });

        this.logger.log('Serviço de E-mail (Gmail com OAuth2) inicializado e pronto para enviar.');
    }

    async sendMail(
        to: string,
        subject: string,
        html: string,
        fromAliasEmail: string,
        fromAliasName?: string,
    ) {
        if (!this.transporter) {
            this.logger.error('Transporter do Nodemailer não inicializado. Verifique as credenciais e a inicialização no construtor.');
            throw new Error('Serviço de e-mail não configurado corretamente ou falha na inicialização.');
        }

        const mailOptions = {
            from: fromAliasName ? `"${fromAliasName}" <${fromAliasEmail}>` : fromAliasEmail, // Formato corrigido
            to: to,
            subject: subject,
            html: html,
        };

        try {
            const info = await this.transporter.sendMail(mailOptions);
            this.logger.log(`E-mail enviado: ${info.messageId} para ${to} de ${mailOptions.from}`);
            return info;
        } catch (error) {
            this.logger.error(`Erro ao enviar e-mail para ${to} de ${mailOptions.from}:`, error.message || error);
            // Você pode querer extrair mais informações do erro, como error.response
            throw error; // Re-lança o erro para ser tratado pelo chamador
        }
    }
} // Removida a chave extra que estava aqui