# Public client configuration is embedded by Expo during export.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=dev
COPY app.json tsconfig.json expo-env.d.ts ./
COPY app ./app
COPY src ./src
COPY public ./public
ARG EXPO_PUBLIC_SUPABASE_URL
ARG EXPO_PUBLIC_SUPABASE_ANON_KEY
ENV EXPO_NO_DOTENV=1
RUN npm run build:web

FROM nginxinc/nginx-unprivileged:stable-alpine AS runtime
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
USER 101
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q -O - http://127.0.0.1:8080/health.json | grep -qx '{"status":"ok","app":"irontrack"}' || exit 1
CMD ["nginx", "-g", "daemon off;"]
