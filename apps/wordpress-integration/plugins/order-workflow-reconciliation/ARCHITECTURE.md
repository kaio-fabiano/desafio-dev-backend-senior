# Order Workflow Reconciliation architecture

- Bounded context: Commercial, at the WordPress/WooCommerce integration boundary.
- Use case: expose the stable workflow operation reference to WooCommerce's native order search.
- Aggregate: none. The plugin configures search metadata and does not create or mutate a business aggregate; `WC_Order` remains authoritative in WooCommerce.
- Invariants: preserve existing search fields, add the operation-reference key once, register both legacy and HPOS search hooks, declare HPOS compatibility against the main plugin file, and introduce no cart/order persistence or public write endpoint.
- Consistency boundary: one WordPress request registering deterministic WooCommerce hooks; no plugin-owned persistence transaction exists.
- Affected ports: WordPress actions/filters and WooCommerce `FeaturesUtil`. Existing REST and GraphQL contracts remain owned by the pinned WooCommerce/WPGraphQL plugins and are unchanged.
- Security boundary: the plugin accepts no HTTP, REST, AJAX, form, cookie, or file input and exposes no state-changing operation. Nonce and capability checks therefore have no applicable handler; any future write boundary must add both checks plus WordPress sanitization before use.
- Delivery constraint: the existing clean-environment Compose path copies the main plugin file and is outside T-221's allowlist. The three small namespaced classes therefore remain self-contained in that file, with only composition at the executable bootstrap, so every existing installer keeps working without a speculative autoloader or a forbidden Compose change.

## TDD evidence

- Red command: `node --test --test-reporter=tap test/structural-wordpress-review.test.mjs`
- Expected Red failure: AC-266/AC-268 reported the missing `includes/class-hpos-compatibility.php`, `includes/class-order-search-fields.php`, and `includes/class-plugin.php` boundaries while the existing AC-125 test remained green.
- Refactor finding: deployment-path review showed that mandatory include files would break the out-of-scope root Compose installer. The test retained the behavioral class boundaries but dropped the unnecessary physical-file constraint; no behavioral or security assertion was removed.
