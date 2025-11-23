# --- Estágio 1: Build (Construção) ---
# Usamos uma imagem base do Node.js (v18 é uma boa escolha LTS)
FROM node:18-alpine AS builder

# Define o diretório de trabalho dentro do container
WORKDIR /app

# Copia os arquivos de definição de pacotes e instala
COPY package*.json ./
COPY prisma ./prisma/

# Instala todas as dependências (dev e prod) para buildar
RUN npm install

# Copia todo o resto do código-fonte
COPY . .

# Roda o script de 'build' do NestJS (que inclui prisma generate)
RUN NODE_OPTIONS=--max-old-space-size=2048 npm run build

# --- Estágio 2: Produção (Execução) ---
# Começamos de uma imagem limpa para ser mais leve
FROM node:18-alpine

WORKDIR /app

# Copia o package.json novamente (necessário para instalar deps de produção)
COPY package*.json ./
COPY prisma ./prisma/

# Instala APENAS as dependências de produção
RUN npm install --only=production

# --- CRUCIAL: Copia os artefatos do Prisma gerados no estágio builder ---
# O Client do Prisma geralmente é gerado em node_modules/.prisma ou node_modules/@prisma/client
# Como no estágio 2 instalamos só prod, o @prisma/client existe, mas o .prisma (engine binary) pode não estar lá se não rodarmos generate.
# A melhor prática é copiar do builder onde o generate rodou.
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

# Copia a pasta 'dist' (o código buildado) do estágio 'builder'
COPY --from=builder /app/dist ./dist

# Expõe a porta que sua aplicação NestJS escuta
EXPOSE 3000

# O comando para iniciar sua aplicação
CMD ["node", "dist/main.js"]
