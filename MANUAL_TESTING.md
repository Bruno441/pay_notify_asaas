# Manual Testing & Documentation

## Overview

This project uses NestJS with Prisma (v5.x) to handle Asaas webhooks for payment notifications. The application integrates with a PostgreSQL database to verify reservations and track payments.

## Deployment & Docker

### Docker
The `Dockerfile` has been updated to include a copy step that transfers the generated Prisma Client artifacts from the build stage to the production stage. This ensures that the application has access to the database client at runtime.

### Vercel / Build Scripts
The `package.json` build script includes `npx prisma generate` before the NestJS build:
```json
"build": "npx prisma generate && nest build"
```
This is crucial for serverless environments (like Vercel) where the file system is ephemeral.

## How to Test Manually

You can test the webhook endpoint locally using tools like **Postman**, **Insomnia**, or **cURL**.

### Prerequisites
1.  **Run the App**: Ensure your application is running locally (`npm run start:dev`) or deployed.
2.  **Environment Variables**: Ensure `.env` is configured with `DATABASE_URL` pointing to your database and `ASAAS_WEBHOOK_SECRET` (if token validation is active).

### Test Case: Payment Received (Confirmed)

**Endpoint:** `POST /payment/payment-received`

**Headers:**
*   `Content-Type`: `application/json`
*   `asaas-webhook-token`: `YOUR_SECRET_TOKEN` (if validation is enabled via header, though the controller checks `body.accessToken` too).

**Body (JSON):**
*   Replace `EXTERNAL_REFERENCE_UUID` with a valid `id_reserva` from your `TB_RESERVAS` table to see the database update.

```json
{
  "event": "PAYMENT_CONFIRMED",
  "accessToken": "YOUR_SECRET_TOKEN",
  "payment": {
    "object": "payment",
    "id": "pay_test_123456",
    "customer": "cus_0000055555",
    "value": 150.00,
    "netValue": 145.00,
    "description": "Reserva Teste Manual",
    "externalReference": "EXTERNAL_REFERENCE_UUID",
    "billingType": "CREDIT_CARD",
    "confirmedDate": "2025-11-23",
    "status": "CONFIRMED"
  }
}
```
*Note: The controller accepts a wrapper object where `data` might be a stringified JSON (Asaas style). If you send the object directly as above, the updated logic handles it.*

**Expected Behavior:**
1.  **Response**: HTTP 200 with body `{ "received": true }`.
2.  **Logs**:
    *   "Pagamento ID pay_test_123456 teve o evento: PAYMENT_CONFIRMED"
    *   "Reserva encontrada: ..."
    *   "Status da precificação ... atualizado para confirmado."
    *   "Pagamento registrado na TB_PAGAMENTOS: ..."
3.  **Database**:
    *   `TB_PRECIFICACAO`: Status changes to `confirmado`.
    *   `TB_PAGAMENTOS`: A new record is created with `asaas_id = pay_test_123456`.

### Test Case: Idempotency (Duplicate Payment)

**Action**: Send the *exact same* payload again.

**Expected Behavior:**
1.  **Response**: HTTP 200 `{ "received": true }`.
2.  **Logs**: "Pagamento pay_test_123456 já processado anteriormente. Ignorando."
3.  **Database**: No duplicate record in `TB_PAGAMENTOS`.

### Troubleshooting

*   **Build Errors**: If deployment fails with Prisma errors, verify that `npx prisma generate` is running.
*   **"Reserva não encontrada"**: Check if the UUID passed in `externalReference` exists in `TB_RESERVAS`.
