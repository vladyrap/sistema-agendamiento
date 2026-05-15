FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
# Template procesado por envsubst en el entrypoint built-in de nginx:alpine.
# Solo expandimos BACKEND_HOST para no romper $uri / $remote_addr / etc.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
ENV BACKEND_HOST=backend \
    NGINX_ENVSUBST_FILTER=BACKEND_HOST
EXPOSE 80
