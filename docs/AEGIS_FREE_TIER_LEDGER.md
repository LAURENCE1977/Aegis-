# AEGIS Free-Tier Ledger

## Scope

The first ledger slice is a metadata-only, in-memory index of developer free-tier offers. It validates provider allowance records, official pricing/terms links, quotas and verification dates, and exposes read-only list/get/search functions.

It does not create accounts, provision infrastructure, consume credits, call provider APIs, monitor billing, or guarantee that an offer remains free.

## Record contract

Each entry records provider, service, category, allowance description, duration, card requirement, commercial-use eligibility, overage behaviour, regions, measurable quotas, official pricing and terms URLs, last verification timestamp, confidence and status.

An unknown overage policy must remain explicitly unknown. A directory entry is not evidence of provider terms; records must be verified against official provider pricing and terms before operational use.

## Freshness

Records are considered current for 30 days by default. Older entries remain available as historical evidence but must be re-verified before recommending provisioning. Future verification timestamps are rejected.

## Safety boundary

No provisioning or account-creation method exists. Paid overages are recorded as a risk, not authorized. The future Control Centre must default to budget ceilings and stop-before-paid-overage behavior. No resource is created from this ledger without explicit owner approval.


## Verified-offer rule

Only records with `status: verified` and a verification timestamp inside the freshness window can be reported as current. `candidate` and `expired` records remain searchable as research leads but must never be counted as confirmed free capacity. A verified record is still not a guarantee: re-check the provider's live pricing, terms, billing triggers and commercial-use restrictions before any use.
