FROM php:8.2-apache

RUN apt-get update && apt-get install -y \
    sqlite3 \
    libsqlite3-dev \
    && rm -rf /var/lib/apt/lists/*

RUN a2enmod rewrite \
    && docker-php-ext-install pdo pdo_sqlite

ENV TASKBIT_DB_PATH=/var/www/data/app.sqlite

COPY docker/apache.conf /etc/apache2/sites-available/000-default.conf
COPY . /var/www

RUN mkdir -p /var/www/data /var/www/storage/sessions \
    && chown -R www-data:www-data /var/www/data /var/www/storage \
    && chmod -R 775 /var/www/storage

WORKDIR /var/www

EXPOSE 80

CMD ["apache2-foreground"]
