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

declare( strict_types=1 );

namespace Marketplace\OrderWorkflowReconciliation;

use Automattic\WooCommerce\Utilities\FeaturesUtil;

defined( 'ABSPATH' ) || exit;

/**
 * Declares the plugin's WooCommerce storage compatibility.
 */
final class Hpos_Compatibility {
	/**
	 * @param string $plugin_file Main plugin file.
	 */
	public function __construct( private readonly string $plugin_file ) {}

	/**
	 * Declares High-Performance Order Storage compatibility when available.
	 */
	public function declare_compatibility(): void {
		if ( class_exists( FeaturesUtil::class ) ) {
			FeaturesUtil::declare_compatibility(
				'custom_order_tables',
				$this->plugin_file,
				true
			);
		}
	}
}

/**
 * Adds the workflow operation reference to native order search.
 */
final class Order_Search_Fields {
	private const OPERATION_REFERENCE_META_KEY = '_order_workflow_operation_reference';

	/**
	 * @param string[] $meta_keys Searchable order metadata keys.
	 * @return string[]
	 */
	public function include_operation_reference( array $meta_keys ): array {
		$meta_keys[] = self::OPERATION_REFERENCE_META_KEY;

		return array_values( array_unique( $meta_keys ) );
	}
}

/**
 * Registers the plugin's WordPress and WooCommerce hooks.
 */
final class Plugin {
	/**
	 * @param Hpos_Compatibility  $hpos_compatibility WooCommerce compatibility declaration.
	 * @param Order_Search_Fields $order_search_fields Native order-search fields.
	 */
	public function __construct(
		private readonly Hpos_Compatibility $hpos_compatibility,
		private readonly Order_Search_Fields $order_search_fields
	) {}

	/**
	 * Registers hooks without running integration behavior eagerly.
	 */
	public function register_hooks(): void {
		add_action(
			'before_woocommerce_init',
			array( $this->hpos_compatibility, 'declare_compatibility' ),
			10,
			0
		);
		add_filter(
			'woocommerce_shop_order_search_fields',
			array( $this->order_search_fields, 'include_operation_reference' ),
			10,
			1
		);
		add_filter(
			'woocommerce_order_table_search_query_meta_keys',
			array( $this->order_search_fields, 'include_operation_reference' ),
			10,
			1
		);
	}
}

( new Plugin(
	new Hpos_Compatibility( __FILE__ ),
	new Order_Search_Fields()
) )->register_hooks();
