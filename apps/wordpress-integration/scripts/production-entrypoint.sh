#!/usr/bin/env bash
set -euo pipefail

required=(WORDPRESS_URL WORDPRESS_ADMIN_PASSWORD WPGRAPHQL_SITE_TOKEN WOO_CONSUMER_KEY WOO_CONSUMER_SECRET)
for name in "${required[@]}"; do
  [[ -n "${!name:-}" ]] || { echo "$name is required" >&2; exit 1; }
done

/usr/local/bin/docker-entrypoint.sh "$@" &
wordpress_pid=$!
trap 'kill -TERM "$wordpress_pid" 2>/dev/null || true' TERM INT

wp=(wp --allow-root --path=/var/www/html)
for attempt in $(seq 1 90); do
  [[ -f /var/www/html/wp-config.php ]] && "${wp[@]}" core version >/dev/null 2>&1 && break
  [[ "$attempt" != 90 ]] || { echo 'WordPress did not become ready' >&2; exit 1; }
  sleep 2
done

if ! "${wp[@]}" core is-installed >/dev/null 2>&1; then
  "${wp[@]}" core install --url="$WORDPRESS_URL" --title=Marketplace \
    --admin_user=marketplace-admin --admin_password="$WORDPRESS_ADMIN_PASSWORD" \
    --admin_email=admin@marketplace.local --skip-email
fi

"${wp[@]}" plugin activate woocommerce wp-graphql wp-graphql-woocommerce \
  wp-graphql-headless-login wp-graphql-federations order-workflow-reconciliation
"${wp[@]}" option update woocommerce_cod_settings '{"enabled":"yes","title":"Cash on delivery"}' --format=json
"${wp[@]}" option update wpgraphql_federation_settings '{"Order":{"enabled":true,"key":"id","kind":"post_type","wp_name":"shop_order"},"SimpleProduct":{"enabled":true,"key":"id","kind":"post_type","wp_name":"product"},"VariableProduct":{"enabled":true,"key":"id","kind":"post_type","wp_name":"product"},"ExternalProduct":{"enabled":true,"key":"id","kind":"post_type","wp_name":"product"},"GroupProduct":{"enabled":true,"key":"id","kind":"post_type","wp_name":"product"}}' --format=json
"${wp[@]}" eval 'update_option("wpgraphql_login_access_control", ["shouldBlockUnauthorizedDomains" => true, "hasSiteAddressInOrigin" => true, "additionalAuthorizedDomains" => [rtrim(getenv("WORDPRESS_URL"), "/")], "customHeaders" => []]);'
"${wp[@]}" eval 'update_option("wpgraphql_login_provider_siteToken", ["isEnabled" => true, "clientOptions" => ["headerKey" => "X-WPGraphQL-Site-Token", "secretKey" => getenv("WPGRAPHQL_SITE_TOKEN")], "loginOptions" => ["metaKey" => "better_auth_user_id"]]);'
if ! "${wp[@]}" user get payment-federation --field=ID >/dev/null 2>&1; then
  "${wp[@]}" user create payment-federation payment-federation@example.test \
    --role=shop_manager --user_pass="$(openssl rand -hex 24)"
fi
"${wp[@]}" user meta update payment-federation better_auth_user_id payment-federation
"${wp[@]}" eval 'global $wpdb; $table = $wpdb->prefix . "woocommerce_api_keys"; $key = getenv("WOO_CONSUMER_KEY"); if (!$wpdb->get_var($wpdb->prepare("SELECT key_id FROM {$table} WHERE consumer_key = %s", wc_api_hash($key)))) { $wpdb->insert($table, ["user_id" => 1, "description" => "Marketplace services", "permissions" => "read_write", "consumer_key" => wc_api_hash($key), "consumer_secret" => getenv("WOO_CONSUMER_SECRET"), "truncated_key" => substr($key, -7)]); }'
"${wp[@]}" rewrite structure '/%postname%/' --hard
"${wp[@]}" cache flush
touch /var/www/html/.marketplace-ready

wait "$wordpress_pid"
