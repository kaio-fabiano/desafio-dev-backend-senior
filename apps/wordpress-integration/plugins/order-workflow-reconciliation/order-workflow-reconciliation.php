<?php
/**
 * Plugin Name: Marketplace Order Workflow Reconciliation
 * Description: Adds the workflow operation reference to native WooCommerce order search.
 * Version: 1.0.0
 * Requires at least: 6.8
 * Requires PHP: 8.3
 * Requires Plugins: woocommerce
 * Author: Marketplace Platform
 * License: GPL-2.0-or-later
 * Text Domain: order-workflow-reconciliation
 */

namespace Marketplace\OrderWorkflowReconciliation;

use Automattic\WooCommerce\Utilities\FeaturesUtil;

defined( 'ABSPATH' ) || exit;

const OPERATION_REFERENCE_META_KEY = '_order_workflow_operation_reference';

/**
 * Declares compatibility with WooCommerce High-Performance Order Storage.
 */
function declare_hpos_compatibility(): void {
	if ( class_exists( FeaturesUtil::class ) ) {
		FeaturesUtil::declare_compatibility( 'custom_order_tables', __FILE__, true );
	}
}

/**
 * Includes the stable workflow reference in WooCommerce's native order search.
 *
 * @param string[] $meta_keys Searchable order metadata keys.
 * @return string[]
 */
function include_operation_reference( array $meta_keys ): array {
	$meta_keys[] = OPERATION_REFERENCE_META_KEY;

	return array_values( array_unique( $meta_keys ) );
}

add_action( 'before_woocommerce_init', __NAMESPACE__ . '\\declare_hpos_compatibility' );
add_filter( 'woocommerce_shop_order_search_fields', __NAMESPACE__ . '\\include_operation_reference' );
add_filter( 'woocommerce_order_table_search_query_meta_keys', __NAMESPACE__ . '\\include_operation_reference' );
