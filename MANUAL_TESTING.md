# Manual Testing & Documentation

## Overview

This project uses NestJS to handle Asaas webhooks for payment notifications. The application now integrates with an external API (`https://somando-sabores-api.onrender.com/api/Reserva`) to verify reservation statuses instead of a direct database connection.

## Deployment

The application logic has been updated to bypass Prisma/Database connection issues by relying on the external API. Prisma artifacts are still generated in the Docker build process in case they are needed later, but the application runtime does not currently instantiate the Prisma Client.

## How to Test Manually

You can test the webhook endpoint locally using tools like **Postman**, **Insomnia**, or **cURL**.

### Prerequisites
1.  **Run the App**: Ensure your application is running locally (`npm run start:dev`) or deployed.
2.  **Environment Variables**: Ensure `ASAAS_WEBHOOK_SECRET` is configured (if token validation is active).

### Test Case: Payment Received (Api Verification)

**Endpoint:** `POST /payment/payment-received`

**Headers:**
*   `Content-Type`: `application/json`
*   `asaas-webhook-token`: `YOUR_SECRET_TOKEN`

**Body (JSON):**
*   Replace `EXTERNAL_REFERENCE_UUID` with a valid ID that exists in the external API (`https://somando-sabores-api.onrender.com/api/Reserva`).
*   **Scenario 1 (Already Paid)**: Use an ID where `status` is `1` in the API.
*   **Scenario 2 (Pending)**: Use an ID where `status` is `0` in the API.

```json
{
  "event": "PAYMENT_CONFIRMED",
  "accessToken": "YOUR_SECRET_TOKEN",
  "payment": {
    "object": "payment",
    "id": "pay_test_api_verification",
    "customer": "cus_0000055555",
    "value": 150.00,
    "netValue": 145.00,
    "description": "Reserva Teste API",
    "externalReference": "019a7fa5-221b-78b3-b2e4-c914dccd27c8",
    "billingType": "CREDIT_CARD",
    "confirmedDate": "2025-11-23",
    "status": "CONFIRMED"
  }
}
```

**Expected Behavior:**

1.  **If Status is 1 (Paid)**:
    *   **Response**: HTTP 200 `{ "received": true }`.
    *   **Logs**: "Reserva ... já está com status 1 (pago). Ignorando envio de e-mail."
    *   **Email**: No email is sent.

2.  **If Status is 0 (Pending)**:
    *   **Response**: HTTP 200 `{ "received": true }`.
    *   **Logs**: "Reserva ... está com status 0 (pendente). Prosseguindo com envio de e-mail."
    *   **Email**: Email is sent to the customer.

### Troubleshooting

*   **"Reserva não encontrada"**: The `externalReference` ID must match an `id` field in the response from `https://somando-sabores-api.onrender.com/api/Reserva`.
*   **Vercel Errors**: If you see `TypeError: ... PrismaClient`, ensure `PrismaModule` is removed from `AppModule` imports.
