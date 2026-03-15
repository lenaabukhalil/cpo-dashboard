# ===== Build stage =====
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Optional: override at build time via docker-compose build args
ARG VITE_APP_VERSION=0.1.9
ENV VITE_APP_VERSION=$VITE_APP_VERSION

RUN npm run build

# ===== Runtime stage =====
FROM nginx:alpine

RUN rm /etc/nginx/conf.d/default.conf

COPY nginx/nginx.conf /etc/nginx/conf.d/cpo-dashboard.conf

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
