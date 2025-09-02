import { Injectable, Logger } from '@nestjs/common'; // Logger importado
import * as nodemailer from 'nodemailer';
import { google } from 'googleapis';
import axios from 'axios';

@Injectable()
export class PaymentReceivedService { 
    private readonly logger = new Logger(PaymentReceivedService.name); 
    private transporter: nodemailer.Transporter;
    private gmailEmail: string;
    private urlSearchClient: string = "https://api-sandbox.asaas.com/v3/customers/";
    private acessToken: string 

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
            this.logger.error('Credenciais do Gmail ou OAuth não configuradas corretamente no .env! O serviço de e-mail pode não funcionar.');
            throw new Error('Falha ao inicializar o serviço de e-mail: credenciais ausentes.');
        }

        const OAuth2 = google.auth.OAuth2;
        const oauth2Client = new OAuth2(
            clientId,
            clientSecret,
            'https://developers.google.com/oauthplayground', // URL de redirecionamento para OAuth2
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
            throw error; 
        }
    }

    async getClientById(clientId: string) {
        const url = `${this.urlSearchClient}${clientId}`;
        const headers = {
            'Content-Type': 'application/json',
            'access_token': this.acessToken,
        };

        try {
            const response = await axios.get(url, { headers });
            this.logger.log(`Cliente encontrado: ${JSON.stringify(response.data)}`);
            return response;
        } catch (error) {
            this.logger.error(`Erro ao buscar cliente com ID ${clientId}:`, error.response?.data || error.message || error);
            throw error;
        }
    }
}