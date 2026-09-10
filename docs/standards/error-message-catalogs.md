# Error message catalogs

Each bounded context owns its error-message catalog. Production exception construction must receive a non-empty value from that catalog (a constant, enum entry, or formatter); inline message literals and message-less exceptions are rejected by `node tools/error-messages/error-message-policy.mjs`.

The gate scans only Gateway, Identity, Platform OAuth, and the Java Transaction, Inventory, Payment, and shared transaction boundaries. Tests, fixtures, scripts, generated sources, migrations outside the transaction boundary, and E2E harnesses are excluded.

Catalog entries preserve existing observable text and dynamic details. Do not share a global catalog across bounded contexts.
