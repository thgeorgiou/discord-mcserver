# Build app in seperate container
FROM node:12-alpine AS builder
WORKDIR /app
COPY . .
RUN yarn install
RUN yarn run build

# Don't install dev-dependencies
FROM node:12-alpine
WORKDIR /app

# Copy app from builder
COPY --from=builder /app/dist/ ./dist/
COPY infrastructure/ ./infrastructure/
COPY package.json .

# Install terraform from the official container
COPY --from=hashicorp/terraform:0.12.21 /bin/terraform /bin/
COPY --from=hashicorp/terraform:0.12.21 /usr/local/share/ca-certificates/ /usr/local/share/ca-certificates/

ENV MCSERVER_TERRAFORM /app/infrastructure

RUN yarn install --production
CMD ["yarn", "run", "start:prod"]