FROM node:14-buster-slim

# Add ReACT root certificate
RUN apt-get update && apt-get install ca-certificates -y

# Build app inside container
WORKDIR /app
COPY . .
RUN yarn install
RUN yarn run build

ENV NODE_ENV production

# Command for starting the app
CMD ["yarn", "run", "start:prod"]
