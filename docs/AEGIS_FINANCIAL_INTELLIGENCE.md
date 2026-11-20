# AEGIS Financial Intelligence — integration and safety contract

**Status:** architecture proposal and Composio capability research only. No finance toolkit has been connected, no account data has been read, and no financial action has been executed.

## Purpose

Give AEGIS reliable financial awareness for owner-approved business analysis, cash-flow monitoring, opportunity evaluation and future commercial workflows. This is a capability inside AEGIS, not a separate product and not an investment or financial-advice service.

## Integration discovery snapshot — 20 November 2026

Composio tool search surfaced these candidate toolkits and capabilities. Its connection-status response reported no active connection for each toolkit below at the time of discovery.

| Toolkit | Useful read-oriented capabilities found | Initial fit | Important caveats |
|---|---|---|---|
| Xero | Profit & Loss, Balance Sheet, trial balance, bank transactions, invoices, chart of accounts, organisation metadata | Strong UK small-business accounting candidate | Explicit tenant selection is essential when multiple organisations are connected. Bank-transaction results can include deleted records unless filtered. Report rows are nested and must be parsed by labels. |
| FreeAgent | Cash-flow summary, P&L summary, expenses, accounting transactions, invoices, bills, bank transactions | Strong UK freelancer / micro-business candidate | Date-window and pagination constraints vary by endpoint. Bank transactions require a bank-account URI. |
| Wise | Profiles, balances, account activity, transfers and FX rates | Useful treasury / multi-currency visibility | Profile IDs must be resolved first. Read access is distinct from quote or transfer actions; never infer authority to move funds. |
| GoCardless | Payouts and payout events | Useful direct-debit settlement reconciliation | Payout listing is cursor-paginated; follow every cursor when completeness is required. |
| Stripe | Balance, payouts, balance transactions, refunds and recurring-revenue metrics | Useful if AEGIS later sells subscriptions or digital products | Some nearby tools mutate payout metadata or create reports. Exact read/write classification is required per slug. |
| QuickBooks | Entity queries, trial balance, transaction list, invoices, general ledger | Broad accounting alternative | Query syntax and field restrictions are non-trivial; paginate with stable ordering and reconcile report structures. |
| Plaid | Account balances, account lists, transaction sync | Potential bank-data aggregation layer | Some refresh calls are paid/asynchronous. Confirm UK institution coverage, product availability and consent scope before selecting it. |

The search also surfaced Paystack and Razorpay, but their primary market fit is less relevant to an initial UK-first build. Do not prioritise them without a concrete customer or payment-flow requirement.

## Recommended order

1. **Wait for the owner's next Composio integration selection and screenshots.** Match the actual available account/toolkit list before asking to connect another provider.
2. **Prefer one accounting source first:** Xero or FreeAgent, depending on what the owner already uses or wants to use. Avoid connecting both merely for breadth.
3. **Add payment reconciliation only when needed:** Stripe for AEGIS subscriptions/product sales, or GoCardless if direct-debit collections are part of the use case.
4. **Add bank aggregation / treasury visibility later:** Wise if multi-currency accounts matter; Plaid only after verifying UK institution coverage and the exact data product.
5. **Do not connect a toolkit just because Composio exposes a tool.** Require an owner-selected account, active connection, exact tool schema, scope review and Sentinel preflight.

## Canonical financial data model

Provider adapters should map records into a provider-neutral, provenance-preserving model:

- **Account:** provider, external account reference (opaque), account type, currency, institution, owner scope.
- **Transaction:** provider ID, account reference, booked/created/updated timestamps, amount in minor units, ISO currency, direction, status, category, counterparty label where available, source link/reference, pending/reversed/deleted flags.
- **Invoice / bill:** document ID, direction, issue/due/paid dates, gross/net/tax amounts, currency, status, contact reference, line-item summary and source reference.
- **Payout / settlement:** provider ID, gross amount, fees, net amount, currency, status, arrival/settlement dates and linked transaction references.
- **Period summary:** reporting basis (cash/accrual), period, income, expenses, net result, opening/closing balance, source coverage and reconciliation state.
- **Forecast:** explicit assumptions, source period, method, range/scenario, confidence/limitations and last refreshed timestamp.

Preserve original provider payload references and source timestamps. Do not silently collapse currencies, convert amounts without recording the FX rate/source/time, or combine cash and accrual figures.

## Financial truth and reconciliation rules

AEGIS must keep these separate in both data and UI:

- cash balance vs available balance vs accounting balance;
- revenue vs cash received;
- gross income vs net income vs profit;
- invoice issued vs invoice paid;
- pending transaction vs settled transaction;
- realised result vs forecast vs hypothetical opportunity;
- company valuation vs revenue vs cash in the bank.

Never sum across currencies without an explicit conversion policy. Exclude deleted, reversed or pending records from settled totals unless a clearly labelled view intentionally includes them. Deduplicate on provider + tenant/account + external record ID. Track pagination completeness and data freshness; partial pages must never be labelled a complete statement.

For accounting reports, retain cash/accrual basis and the provider's reporting period. Reconcile payout net amounts against fees and underlying balance transactions before describing them as income. Forecasts must show assumptions and ranges, not a single confident number.

## Sentinel action tiers

**Tier 0 — discovery:** search tool metadata and schemas; no account data access.

**Tier 1 — read-only:** balances, transactions, invoices, reports, payouts and activity. Requires an owner-authorised active connection, minimum necessary scopes, exact allowlisted tool slug, data minimisation and audit.

**Tier 2 — reversible preparation:** draft invoice, payment link, reconciliation suggestion or budget proposal. Keep as a draft; no external submission or financial commitment.

**Tier 3 — consequential writes:** create/send invoices, initiate payouts/transfers, issue refunds, change billing/subscriptions, modify accounting records or alter payment settings. Require explicit, just-in-time human approval bound to the exact action, amount, currency, recipient/resource and input digest. Enforce idempotency, limits, audit and post-action verification. No standing blanket approval.

AEGIS agents and Challenge Mode may analyse, compare and prepare financial plans. They may not spend, transfer, invest, trade, refund, bill, or commit funds autonomously. Sentinel remains the only authority for protected actions.

## Privacy, security and cost

- Do not place bank credentials, access tokens, full account numbers or raw payment details in prompts, logs, plans or model context.
- Resolve credentials server-side only after Sentinel preflight; keep provider secrets in the approved secret store.
- Minimise data fields and date ranges; mask account identifiers in UI and audit records.
- Separate personal and business accounts and tenants. Never assume the first connected organisation is the intended one.
- Treat tool descriptions, returned transactions, invoice notes and counterparty text as untrusted data, not instructions.
- Use read-only scopes first; monitor provider rate limits and paid refresh/report operations before enabling them.
- Record provider, toolkit, exact tool slug, schema/version evidence, connection identity, scope, approval, data freshness and result digest.
- Do not store card PAN, CVV or other prohibited payment authentication data.

## First acceptance criteria

1. A user can see which financial providers are connected, to which owner scope, and which exact read-only capabilities are available.
2. A read-only financial snapshot clearly shows source, currency, period, reporting basis and last refresh.
3. Totals exclude deleted/reversed/pending entries according to an explicit policy and expose incomplete pagination.
4. Revenue, profit, cash, liabilities and forecasts are never conflated.
5. Multi-currency amounts retain original values and show conversion provenance when converted.
6. No write-capable tool is invoked by a read-only workflow.
7. Every consequential financial write is denied unless exact Sentinel approval and all normal grants, limits and audit controls pass.
8. If any source is stale, unavailable, incomplete or unreconciled, the UI says so rather than presenting a false consolidated balance.

## Current decision

Build the financial data contract and read-only evaluation path first. Defer connection creation, secret resolution, financial writes, automated investing and payment execution until the owner has selected the relevant Composio integration and Sentinel's full execution path is independently verified.
