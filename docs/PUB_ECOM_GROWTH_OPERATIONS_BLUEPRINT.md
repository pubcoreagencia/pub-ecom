# PUB ECOM — GROWTH & OPERATIONS BLUEPRINT

## Purpose

This document materializes the product decisions defined for the next PUB ECOM implementation cycle so development does not depend on conversation history.

## 1. Master Command Center

MASTER is the operational control plane of PUB ECOM.

Primary areas:

- Dashboard
- Live Shop
- Stores
- Orders
- Suppliers
- Fulfillment
- Central Finance
- Acquisition / Ads
- SEO
- Audience Engine
- Affiliates
- Influencers / Creators
- Rankings
- Goals / Bonuses / Awards
- Settings

## 2. Live Shop

Real-time metrics:

- visitors online;
- product views;
- open carts;
- active checkouts;
- simultaneous purchases;
- revenue now/today;
- live order feed;
- store responsible for each sale.

The live layer should be event-driven using WebSocket/SSE or an equivalent real-time transport.

## 3. Store Financial Center

MASTER must show all registered Stores and their financial performance.

Per-store metrics:

- revenue;
- orders;
- average order value;
- products sold;
- product costs;
- shipping;
- payment fees;
- discounts/refunds;
- operational result;
- affiliate commissions;
- influencer shares.

The dashboard must support time filters and drill-down from consolidated platform totals to a specific Store.

## 4. Store Ranking / Monthly Awards

Default ranking dimensions:

- 40% revenue;
- 20% orders;
- 20% conversion;
- 10% growth versus prior period;
- 10% operational quality.

Weights must be configurable rather than hard-coded.

MASTER can configure monthly prizes, goals and temporary campaigns.

## 5. Affiliate Program

Affiliate is a performance role.

Affiliate dashboard:

- clicks;
- sessions;
- product views;
- carts;
- checkouts;
- orders;
- attributed revenue;
- commission rate;
- commission earned;
- pending/available amounts.

No fixed work payment in the baseline model. Compensation is a percentage of attributed sales.

## 6. Influencer / Creator Program

Influencer is a performance creator role.

Baseline commercial rule:

`Influencer Share = 50% of Net Profit from attributed sales`

Net profit calculation:

`Gross Sale - Product Cost - Shipping - Payment Fees - Refunds - Discounts - Other Deductible Costs = Net Profit`

The share is configurable in data even when the default is 50%.

Creator attribution must support links and/or codes and connect to the same session/order attribution layer as affiliates and paid acquisition.

## 7. Unified Acquisition Funnel

Canonical funnel:

`page_view → add_to_cart → add_payment_info → purchase`

Every event must preserve attribution context where available:

- session_id;
- event_id;
- store_id;
- product_id;
- campaign_id;
- affiliate_id;
- influencer_id;
- utm_source;
- utm_medium;
- utm_campaign;
- utm_content;
- utm_term;
- landing_page;
- timestamp.

## 8. Custom Audiences at Every Funnel Level

The Audience Engine automatically defines audiences from first-party events.

### Level 1 — Page View

Include product/page viewers within configurable windows.

Typical windows:
1, 3, 7, 14, 30 days.

Exclude:
- purchasers;
- optionally cart/checkout users depending on campaign strategy.

### Level 2 — Add to Cart

Include cart users within configurable windows.

Typical windows:
1, 3, 7, 14, 30 days.

Exclude purchasers.

### Level 3 — Add Payment Info

Include checkout/payment-info users within configurable windows.

Typical windows:
1, 3, 7, 14, 30 days.

Exclude purchasers.

### Level 4 — Purchase

Include purchasers in retention windows:
7, 30, 90, 180, 365 days.

Use for:
- retention;
- cross-sell;
- upsell;
- replenishment;
- repeat purchase;
- high-value customer segments.

## 9. Audience Segmentation

Audiences may be segmented by:

- Store;
- product;
- category;
- campaign;
- source/medium;
- affiliate;
- influencer;
- purchase value;
- purchase frequency;
- recency;
- customer status.

Audience rules must support inclusion and exclusion to prevent overlapping recovery campaigns from competing for the same customer.

## 10. Ads Integrations

Target integrations:

### Meta

- Pixel/conversion events;
- Custom Audiences;
- product catalog;
- remarketing;
- campaign attribution.

### Google

- Google Ads conversion tracking;
- remarketing audiences;
- Merchant Center product feed;
- Shopping/product discovery;
- organic search measurement.

The provider integrations are downstream consumers. PUB ECOM event and attribution data remains the internal source of truth.

## 11. UTM / UTMify Compatibility

The checkout/session pipeline must preserve UTM parameters from landing through purchase.

At minimum:

- utm_source;
- utm_medium;
- utm_campaign;
- utm_content;
- utm_term.

The architecture must be compatible with UTMify-style checkout attribution without coupling the core data model to a single provider.

## 12. Transparent Checkout / Gateway Layer

Checkout must be transparent to the customer and provider-neutral internally.

Required flow:

`Landing → Product → Cart → Checkout → Payment Gateway → Authoritative Payment Confirmation → Purchase Event`

Payment abstraction must support multiple gateways.

Payment records should retain:

- payment_id;
- order_id;
- gateway;
- transaction_id;
- status;
- amount;
- fees;
- method;
- installments where applicable;
- paid_at.

`purchase` must not be emitted as a successful conversion solely because a client reached a payment form. It must follow the authoritative payment state.

## 13. SEO / Product Discovery

Cataloged products should be automatically eligible for useful indexable product pages.

Required SEO foundation:

- clean URL;
- title;
- meta description;
- H1;
- product description/specifications;
- canonical;
- Product structured data;
- price/availability;
- Open Graph;
- sitemap inclusion.

Catalog flow:

`Master Catalog → Store Product → SEO Product Page → Sitemap/Product Feed → Search/Shopping Discovery`

Do not create low-value or empty pages solely to manipulate search engines.

## 14. Fulfillment Link

After purchase:

`Order → Store Identification → Product → Supplier → PUB ECOM Purchase → Supplier Fulfillment → Customer Address → Tracking → Delivered`

The same Order/Attribution record must connect commerce, finance and fulfillment.

## 15. Unified Economic Event

A confirmed purchase must fan out to:

- order state;
- financial transaction/ledger;
- attribution;
- store revenue;
- affiliate commission where applicable;
- influencer net-profit share where applicable;
- inventory/fulfillment workflow;
- ranking metrics;
- post-purchase audience;
- analytics.

This is the central architectural principle for the next phase.

## 16. Privacy / Security

Tracking must use first-party identifiers and minimize PII.

Partner dashboards must never expose unnecessary customer personal information.

Provider integrations must receive only the data required for the specific integration and purpose.

RLS remains the final enforcement layer.

## 17. Implementation Rule

The current database foundation `00001 → 00015` is frozen.

Any persistence required by this blueprint must be introduced through migrations beginning at `00016`.

Do not represent a documented feature as implemented until:

1. source code exists;
2. required migrations exist;
3. tests exist;
4. security boundaries are verified;
5. build/typecheck/lint/tests pass where applicable;
6. the Master Context is updated.
