# --- Estágio 1: Build (Construção) ---
# Usamos uma imagem base do Node.js (v18 é uma boa escolha LTS)
FROM node:18-alpine AS builder

# Define o diretório de trabalho dentro do container
WORKDIR /app

# Copia os arquivos de definição de pacotes e instala
COPY package*.json ./
RUN npm install

# Copia todo o resto do código-fonte
COPY . .

# Roda o script de 'build' do NestJS
RUN npm run build

# --- Estágio 2: Produção (Execução) ---
# Começamos de uma imagem limpa para ser mais leve
FROM node:18-alpine

WORKDIR /app

# Copia o package.json novamente (necessário para instalar deps de produção)
COPY package*.json ./

# Instala APENAS as dependências de produção
RUN npm install --only=production

# Copia a pasta 'dist' (o código buildado) do estágio 'builder'
COPY --from=builder /app/dist ./dist

# Expõe a porta que sua aplicação NestJS escuta
# (Certifique-se que seu main.ts usa 'process.env.PORT || 3000')
EXPOSE 3000

# O comando para iniciar sua aplicação
CMD ["node", "dist/main.js"]