# DATABASE CONTRACT

## FROZEN EXISTING DATABASE CONTRACT (00001 → 00015)
- 00001_core_and_enums.sql
- 00002_identity.sql
- 00003_catalog_inventory.sql
- 00004_commerce.sql
- 00005_orders_shipping.sql
- 00006_finance_audit.sql
- 00007_rpc_rls_security.sql
- 00008_store_platform.sql
- 00009_media.sql
- 00010_media_security.sql
- 00011_tracking_analytics.sql
- 00012_cart_items.sql
- 00013_commerce_transactions.sql
- 00014_checkout_transactions.sql
- 00015_anon_http_api_privileges.sql

## FUTURE DATABASE WORK
Any subsequent architectural shift (e.g. Orders execution, Payment webhooks) requires migrations beginning at `00016`. Do not alter the frozen 00001-00015 contract.
