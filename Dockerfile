FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.ts tsconfig*.json tailwind.config.ts postcss.config.js components.json eslint.config.js ./
COPY public/ public/
COPY src/ src/
ARG VITE_API_URL
ARG VITE_MAPBOX_TOKEN
ARG VITE_SERVER_PUBLIC_KEY
ARG VITE_CERT_TYPE
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_MAPBOX_TOKEN=$VITE_MAPBOX_TOKEN
ENV VITE_SERVER_PUBLIC_KEY=$VITE_SERVER_PUBLIC_KEY
ENV VITE_CERT_TYPE=$VITE_CERT_TYPE
RUN npm run build

FROM node:24-alpine
RUN npm install -g serve@latest
WORKDIR /app
COPY --from=build /app/dist .
EXPOSE 3000
CMD ["serve", "-s", ".", "-l", "3000"]
