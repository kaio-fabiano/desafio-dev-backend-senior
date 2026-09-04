FROM wordpress:6.8.2-php8.3-apache

ARG WP_CLI_VERSION=2.12.0

RUN curl --fail --location --silent --show-error \
      "https://github.com/wp-cli/wp-cli/releases/download/v${WP_CLI_VERSION}/wp-cli-${WP_CLI_VERSION}.phar" \
      --output /usr/local/bin/wp \
    && apt-get update \
    && apt-get install --yes --no-install-recommends unzip \
    && chmod +x /usr/local/bin/wp \
    && install -d /usr/src/wordpress/wp-content/plugins \
    && curl --fail --location --silent --show-error https://downloads.wordpress.org/plugin/woocommerce.10.4.3.zip --output /tmp/woocommerce.zip \
    && curl --fail --location --silent --show-error https://downloads.wordpress.org/plugin/wp-graphql.2.20.0.zip --output /tmp/wp-graphql.zip \
    && curl --fail --location --silent --show-error https://github.com/wp-graphql/wp-graphql-woocommerce/releases/download/v1.0.3/wp-graphql-woocommerce.zip --output /tmp/wp-graphql-woocommerce.zip \
    && curl --fail --location --silent --show-error https://github.com/AxeWP/wp-graphql-headless-login/releases/download/0.4.4/wp-graphql-headless-login.zip --output /tmp/wp-graphql-headless-login.zip \
    && curl --fail --location --silent --show-error https://github.com/Manuel-Antunes/wp-graphql-federations/archive/ac480974ceb6a1680410f955005e060056f150da.zip --output /tmp/wp-graphql-federations.zip \
    && unzip -q /tmp/woocommerce.zip -d /usr/src/wordpress/wp-content/plugins \
    && unzip -q /tmp/wp-graphql.zip -d /usr/src/wordpress/wp-content/plugins \
    && install -d /usr/src/wordpress/wp-content/plugins/wp-graphql-woocommerce \
    && unzip -q /tmp/wp-graphql-woocommerce.zip -d /usr/src/wordpress/wp-content/plugins/wp-graphql-woocommerce \
    && install -d /usr/src/wordpress/wp-content/plugins/wp-graphql-headless-login \
    && unzip -q /tmp/wp-graphql-headless-login.zip -d /usr/src/wordpress/wp-content/plugins/wp-graphql-headless-login \
    && unzip -q /tmp/wp-graphql-federations.zip -d /usr/src/wordpress/wp-content/plugins \
    && mv /usr/src/wordpress/wp-content/plugins/wp-graphql-federations-* /usr/src/wordpress/wp-content/plugins/wp-graphql-federations \
    && rm /tmp/*.zip \
    && apt-get purge --yes --auto-remove unzip \
    && rm -rf /var/lib/apt/lists/*

COPY apps/wordpress-integration/plugins/order-workflow-reconciliation/order-workflow-reconciliation.php \
  /usr/src/wordpress/wp-content/plugins/order-workflow-reconciliation/order-workflow-reconciliation.php
COPY apps/wordpress-integration/scripts/production-entrypoint.sh /usr/local/bin/marketplace-wordpress-entrypoint

RUN chmod +x /usr/local/bin/marketplace-wordpress-entrypoint

ENTRYPOINT ["marketplace-wordpress-entrypoint"]
CMD ["apache2-foreground"]
