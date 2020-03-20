FROM node:12-alpine

# Install terraform from the official container
COPY --from=hashicorp/terraform:0.12.21 /bin/terraform /bin/
COPY --from=hashicorp/terraform:0.12.21 /usr/local/share/ca-certificates/ /usr/local/share/ca-certificates/

ENV MCSERVER_TERRAFORM /app/infrastructure

# Install discord-mcserver
WORKDIR /app
COPY . .
RUN yarn install
CMD ["yarn", "start"]
