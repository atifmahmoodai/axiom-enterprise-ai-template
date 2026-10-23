# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 PYTHON_BIN=/opt/venv/bin/python
RUN --mount=type=secret,id=proxy_ca,target=/run/proxy-ca,required=false \
    if [ -f /run/proxy-ca ]; then cp /run/proxy-ca /usr/local/share/ca-certificates/session-proxy.crt; fi; \
    update-ca-certificates; apt-get update && apt-get install -y --no-install-recommends python3 python3-venv ca-certificates && rm -r /var/lib/apt/lists/*; \
    if [ -f /usr/local/share/ca-certificates/session-proxy.crt ]; then unlink /usr/local/share/ca-certificates/session-proxy.crt; fi; update-ca-certificates
COPY requirements.txt ./
RUN --mount=type=secret,id=system_ca,required=false \
    mkdir -p /app/.data && chown node:node /app/.data && python3 -m venv /opt/venv && \
    if [ -f /run/secrets/system_ca ]; then PIP_CERT=/run/secrets/system_ca /opt/venv/bin/pip install --no-cache-dir -r requirements.txt; else /opt/venv/bin/pip install --no-cache-dir -r requirements.txt; fi
FROM runtime AS source
COPY --chown=node:node package.json package-lock.json ./
RUN --mount=type=secret,id=proxy_ca,required=false NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca npm ci
COPY --chown=node:node . .
FROM source AS worker
USER node
CMD ["npx", "tsx", "scripts/worker.ts"]
FROM source AS build
RUN npm run build
FROM runtime AS web
ENV NODE_ENV=production HOSTNAME=0.0.0.0 AXIOM_STORAGE_DIR=/app/.data
COPY --from=build --chown=node:node /app/.next/standalone ./
USER node
EXPOSE 3000
CMD ["node", "server.js"]
