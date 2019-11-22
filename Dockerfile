FROM node:12-alpine as build
# set our node environment, either development or production
# defaults to production, compose overrides this to development on build and run
ARG NODE_ENV=production
ENV NODE_ENV $NODE_ENV
# install dependencies first, in a different location for easier app bind mounting for local development
WORKDIR /usr/src
COPY package.json /usr/src
COPY package-lock.json /usr/src

RUN apk add --no-cache libxml2 libgcc curl zlib-dev && \
    apk add --no-cache --virtual .build-deps \
        binutils-gold \
        curl \
        g++ \
        gcc \
        gnupg \
        linux-headers \
        make \
        python \
        && \
    npm config set depth 0 && \
    npm install && \
    npm cache clean --force && \
    apk del .build-deps && \
    rm -rf /tmp/* /var/cache/apk/*

FROM node:12-alpine
# copy in our source code last, as it changes the most
WORKDIR /usr/src/app
ENV PATH /usr/src/node_modules/.bin:$PATH

COPY --from=build /usr/src /usr/src
COPY . /usr/src/app

# set our node environment, either development or production
# defaults to production, compose overrides this to development on build and run
ARG NODE_ENV=production
ENV NODE_ENV $NODE_ENV

# check every 30s to ensure this service returns HTTP 200
# HEALTHCHECK CMD curl -fs http://localhost:$PORT/ || exit 1
# default to port 80 for node, and 5858 or 9229 for debug
ARG PORT=80
ENV PORT $PORT
EXPOSE $PORT 5858 9229
# if you want to use npm start instead, then use `docker run --init in production`
# so that signals are passed properly. Note the code in index.js is needed to catch Docker signals
# using node here is still more graceful stopping then npm with --init afaik
# I still can't come up with a good production way to run with npm and graceful shutdown
CMD [ "node", "app.js" ]