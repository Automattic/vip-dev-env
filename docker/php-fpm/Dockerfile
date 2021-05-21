FROM php:7.4-fpm-alpine

RUN apk update

RUN apk add --no-cache --virtual build-deps autoconf gcc g++ make libffi-dev openssl-dev

RUN apk add --no-cache less bash mariadb-client && \
    apk add --no-cache --virtual build-deps build-base zlib-dev && \
    yes '' | pecl install -f memcache && \
    docker-php-ext-install mysqli && \
    docker-php-ext-enable memcache && \
    wget -O /usr/local/bin/phpunit https://phar.phpunit.de/phpunit-7.phar && \
    chmod a+x /usr/local/bin/phpunit && \
    wget -O /usr/local/bin/wp https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar && \
    chmod a+x /usr/local/bin/wp && \
    apk del build-deps


RUN apk add --no-cache --virtual .phpize-deps $PHPIZE_DEPS \
  && pecl install xdebug \
  && docker-php-ext-enable xdebug \
  && apk del .phpize-deps

ENV WP_CLI_CONFIG_PATH=/config/wp-cli.yaml

COPY wp-cli.yaml /config/wp-cli.yaml

COPY php.ini /usr/local/etc/php/php.ini

COPY xdebug.ini /usr/local/etc/php/conf.d/docker-php-ext-xdebug.ini

CMD ["php-fpm"]
