# Slim image fails on npm install.
# -- Missing git for Time-Core
# -- Missing make and others for bcrypt
# -- Other errors likely
FROM node:12.16.0-buster

WORKDIR /app

RUN apt-get update
# Supports mounting the API and interacting with the DB
RUN apt-get install default-mysql-client -y

COPY package.json package-lock.json .
RUN npm ci

# Pull package-lock from github and install time-core
# Enables DB-migrations
RUN which curl
RUN cd node_modules/time-core && \
    curl -O https://raw.githubusercontent.com/Tornquist/Time-Core/refs/heads/master/package-lock.json 
RUN cd node_modules/time-core && npm ci

COPY . .

ENV SERVER_PORT=8000
ENV DB_HOST=127.0.0.1
ENV DB_PORT=3306
ENV DB_NAME=time
ENV DB_USER=root
ENV DB_PASS=pass

CMD ["node", "server.js"]