FROM node:22.22.3-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build -- --configuration production

FROM nginx:1.29-alpine AS deploy

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/Hackhub/browser /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
