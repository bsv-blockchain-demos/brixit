FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma/ prisma/
RUN npx prisma generate
COPY tsconfig.json tsconfig.scripts.json ./
COPY src/ src/
COPY scripts/ scripts/
RUN npm run build
RUN npx tsc -p tsconfig.scripts.json

FROM node:22-alpine
RUN apk add --no-cache postgresql-client
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/node_modules/.prisma node_modules/.prisma
COPY --from=build /app/node_modules/@prisma node_modules/@prisma
COPY prisma/ prisma/
COPY --from=build /app/dist dist/
COPY entrypoint.sh ./
RUN sed -i 's/\r$//' entrypoint.sh && chmod +x entrypoint.sh
RUN mkdir -p /app/uploads
EXPOSE 3001
ENTRYPOINT ["./entrypoint.sh"]
