FROM debian:bookworm AS lib

ENV DEBIAN_FRONTEND=noninteractive \
    DEBCONF_NONINTERACTIVE_SEEN=true

RUN apt-get update && \
    apt-get install -y --no-install-suggests --no-install-recommends \
    build-essential \
    ca-certificates \
    curl \
    dumb-init \
    gnupg \
    nginx && \
    apt-get clean

RUN curl -fsSL https://deb.nodesource.com/setup_21.x | bash - && \
    curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add - && \
    echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list && \
    curl -sS https://deb.nodesource.com/setup_21.x | bash - && \
    apt-get update && \
    apt-get install -y --no-install-suggests --no-install-recommends \
    nodejs \
    yarn && \
    apt-get clean

WORKDIR /usr/local/share/mghcomputationalpathology/slim

# Install dependencies first and then include code for efficient caching
COPY package.json .
COPY yarn.lock .

# There are sometimes weird network errors. Increasing the network timeout
#  seems to help (see https://github.com/yarnpkg/yarn/issues/5259)
RUN yarn install --frozen-lockfile --network-timeout 100000

COPY craco.config.js .
COPY tsconfig.json .
COPY types ./types
COPY public ./public
COPY scripts ./scripts
COPY src ./src

RUN chmod +x scripts/*.sh


FROM lib AS app

ARG REACT_APP_CONFIG=local
ENV PUBLIC_URL=/

RUN addgroup --system --gid 101 nginx && \
    adduser --system \
            --uid 101 \
            --disabled-login \
            --ingroup nginx \
            --no-create-home \
            --shell /bin/false \
            nginx

RUN NODE_OPTIONS=--max_old_space_size=8192 yarn run build && \
        mkdir -p /var/www/html && \
        cp -R build/* /var/www/html/

RUN mkdir -p /var/run/nginx && \
    chown -R nginx:nginx /var/www/html /var/run/nginx /var/lib/nginx /var/log/nginx && \
    chmod -R 0755 /var/www/html /var/run/nginx /var/lib/nginx /var/log/nginx && \
    rm -r /etc/nginx/conf.d /etc/nginx/sites-available /etc/nginx/sites-enabled

COPY etc/nginx/conf.d /etc/nginx/conf.d
COPY etc/nginx/nginx.conf /etc/nginx/

USER nginx

ENTRYPOINT ["/usr/bin/dumb-init", "--", "nginx", "-g", "daemon off;"]


FROM lib AS test

RUN useradd -m -s /bin/bash tester && \
    mkdir -p artifacts/coverage artifacts/results && \
    chown -R tester:tester artifacts

USER tester

ENTRYPOINT ["/usr/bin/dumb-init", "--", "yarn", "test"]
