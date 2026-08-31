#!/usr/bin/env bash
set -euo pipefail

app_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
compose=(docker compose --file "$app_dir/compose.yaml")

wp() {
  "${compose[@]}" run --rm --no-deps cli wp "$@" </dev/null
}

"${compose[@]}" up --detach --wait database wordpress

for attempt in $(seq 1 30); do
  if wp core version >/dev/null 2>&1; then
    break
  fi
  if [[ "$attempt" == 30 ]]; then
    echo "WordPress files were not ready after 60 seconds" >&2
    exit 1
  fi
  sleep 2
done

if ! wp core is-installed >/dev/null 2>&1; then
  wp core install \
    --url=http://localhost:18080 \
    --title="Federation proof" \
    --admin_user=admin \
    --admin_password=admin-local-only \
    --admin_email=admin@example.test \
    --skip-email
fi

wp plugin install "https://downloads.wordpress.org/plugin/woocommerce.10.4.3.zip" --activate --force
wp plugin install "https://downloads.wordpress.org/plugin/wp-graphql.2.20.0.zip" --activate --force
wp plugin install "https://github.com/wp-graphql/wp-graphql-woocommerce/releases/download/v1.0.3/wp-graphql-woocommerce.zip" --activate --force
wp plugin install "https://github.com/AxeWP/wp-graphql-headless-login/releases/download/0.4.4/wp-graphql-headless-login.zip" --activate --force

federation_commit=ac480974ceb6a1680410f955005e060056f150da
wp plugin install "https://github.com/Manuel-Antunes/wp-graphql-federations/archive/$federation_commit.zip" --force
wp plugin activate wp-graphql-federations

for plugin in woocommerce wp-graphql wp-graphql-woocommerce wp-graphql-federations wp-graphql-headless-login; do
  wp plugin is-active "$plugin"
done
federation_settings='{"Order":{"enabled":true,"key":"id","kind":"post_type","wp_name":"shop_order"},"SimpleProduct":{"enabled":true,"key":"id","kind":"post_type","wp_name":"product"},"VariableProduct":{"enabled":true,"key":"id","kind":"post_type","wp_name":"product"},"ExternalProduct":{"enabled":true,"key":"id","kind":"post_type","wp_name":"product"},"GroupProduct":{"enabled":true,"key":"id","kind":"post_type","wp_name":"product"}}'
wp option update wpgraphql_federation_settings "$federation_settings" --format=json

site_token="${WPGRAPHQL_SITE_TOKEN:-wordpress-local-only}"
site_token_settings="$(jq -cn --arg secret "$site_token" '{isEnabled:true,clientOptions:{headerKey:"X-WPGraphQL-Site-Token",secretKey:$secret},loginOptions:{metaKey:"better_auth_user_id"}}')"
wp option update wpgraphql_login_provider_siteToken "$site_token_settings" --format=json
wp option update wpgraphql_login_access_control '{"shouldBlockUnauthorizedDomains":true,"hasSiteAddressInOrigin":true,"additionalAuthorizedDomains":["http://wordpress"],"customHeaders":[]}' --format=json
if ! wp user get payment-federation --field=ID >/dev/null 2>&1; then
  wp user create payment-federation payment-federation@example.test --role=shop_manager --user_pass=payment-federation-local-only
fi
wp user meta update payment-federation better_auth_user_id payment-federation

webhook_url="${WOO_WEBHOOK_URL:-http://wordpress-federation.local:3004/webhooks/woocommerce/orders}"
if ! wp wc webhook list --user=admin --field=delivery_url --format=csv | grep -Fxq "$webhook_url"; then
  wp wc webhook create --user=admin --name='WordPress Federation order events' --topic=order.updated --delivery_url="$webhook_url" --secret="${WOO_WEBHOOK_SECRET:-woocommerce-local-only}" --status=active >/dev/null
fi

wp role create marketplace_vendor "Marketplace Vendor" 2>/dev/null || true
for capability in read edit_products edit_published_products publish_products; do
  wp cap add marketplace_vendor "$capability"
done
wp cap remove marketplace_vendor edit_others_products 2>/dev/null || true

while IFS=$'\t' read -r username email user_password; do
  if ! wp user get "$username" --field=ID >/dev/null 2>&1; then
    wp user create "$username" "$email" --role=marketplace_vendor --user_pass="$user_password"
  fi
done < <(jq -r '.vendors[] | [.username, .email, .password] | @tsv' "$app_dir/fixtures/products.json")

while IFS=$'\t' read -r sku product_name price owner; do
  product_id="$(wp post list --post_type=product --meta_key=_sku --meta_value="$sku" --field=ID --format=ids)"
  if [[ -z "$product_id" ]]; then
    product_id="$(wp wc product create --user=admin --name="$product_name" --type=simple --regular_price="$price" --sku="$sku" --status=publish --porcelain)"
  fi
  owner_id="$(wp user get "$owner" --field=ID)"
  wp post update "$product_id" --post_author="$owner_id" >/dev/null
done < <(jq -r '.products[] | [.sku, .name, .price, .owner] | @tsv' "$app_dir/fixtures/products.json")

wp rewrite structure '/%postname%/' --hard >/dev/null
wp cache flush >/dev/null

echo "Pinned WordPress commercial graph and fixtures are ready at http://localhost:18080/graphql"
