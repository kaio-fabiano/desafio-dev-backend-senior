<?php
/**
 * Plugin Name: Marketplace Inventory Integration
 * Description: Authenticated atomic-like WooCommerce inventory reservations.
 * Version: 1.0.0
 */

defined('ABSPATH') || exit;

add_action('rest_api_init', function () {
    register_rest_route('marketplace/v1', '/inventory/reserve', [
        'methods' => 'POST',
        'permission_callback' => 'marketplace_inventory_can_write',
        'callback' => 'marketplace_reserve_inventory',
    ]);
});

function marketplace_inventory_can_write() {
    global $wpdb;
    $authorization = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!str_starts_with($authorization, 'Basic ')) {
        return false;
    }
    $credentials = base64_decode(substr($authorization, 6), true);
    if ($credentials === false || !str_contains($credentials, ':')) {
        return false;
    }
    [$consumer_key, $consumer_secret] = explode(':', $credentials, 2);
    $table = $wpdb->prefix . 'woocommerce_api_keys';
    $api_key = $wpdb->get_row($wpdb->prepare(
        "SELECT user_id, consumer_secret, permissions FROM {$table} WHERE consumer_key = %s",
        wc_api_hash($consumer_key)
    ));
    if (!$api_key || !hash_equals($api_key->consumer_secret, $consumer_secret)) {
        return false;
    }
    if (!in_array($api_key->permissions, ['write', 'read_write'], true)) {
        return false;
    }
    wp_set_current_user((int) $api_key->user_id);
    return current_user_can('manage_woocommerce');
}

function marketplace_reserve_inventory(WP_REST_Request $request) {
    error_log('marketplace_inventory received');
    $items = $request->get_json_params()['items'] ?? null;
    if (!is_array($items) || count($items) === 0) {
        return new WP_Error('invalid_items', 'Items must be a non-empty array.', ['status' => 400]);
    }

    $validated = [];
    foreach ($items as $item) {
        $product_id = isset($item['productId']) ? absint($item['productId']) : 0;
        $quantity = isset($item['quantity']) ? absint($item['quantity']) : 0;
        $product = $product_id ? wc_get_product($product_id) : false;
        if (!$product || $quantity < 1) {
            return new WP_Error('invalid_item', 'Every item must reference a product and positive quantity.', ['status' => 400]);
        }
        $stock = $product->get_stock_quantity();
        if (!$product->managing_stock() || $stock === null || $stock < $quantity) {
            return new WP_Error('insufficient_stock', 'WooCommerce stock is insufficient.', ['status' => 409]);
        }
        $validated[] = compact('product', 'quantity');
    }

    $changed = [];
    error_log('marketplace_inventory validated');
    try {
        foreach ($validated as $entry) {
            wc_update_product_stock($entry['product'], $entry['quantity'], 'decrease');
            error_log('marketplace_inventory decremented');
            $changed[] = $entry;
        }
    } catch (Throwable $error) {
        foreach (array_reverse($changed) as $entry) {
            wc_update_product_stock($entry['product'], $entry['quantity'], 'increase');
        }
        return new WP_Error('reservation_failed', 'Inventory reservation failed and was compensated.', ['status' => 500]);
    }

    error_log('marketplace_inventory completed');
    return new WP_REST_Response(['reserved' => true], 200);
}
