# AEGIS canonical invocation input digests

## Purpose

Approval must bind to the exact validated payload that the trusted adapter will execute. The browser, model and agent must never supply the authoritative digest.

## Contract

`functions/lib/canonical-input.mjs` canonicalizes JSON-compatible input with deterministic sorted object keys, then computes a SHA-256 digest in the form `sha256:<64 lowercase hex characters>`.

The helper rejects:
- undefined, functions, symbols, BigInt and non-finite numbers;
- dates, class instances, accessors and non-enumerable properties;
- cycles, sparse arrays, prototype-pollution keys and exotic array properties;
- excessive nesting, collection sizes, key lengths or payload size.

Limits are 16 levels of nesting, 256 collection entries and 64 KiB of canonical UTF-8 input. The digest is stable for equivalent JSON objects regardless of key insertion order.

## Sentinel integration boundary

A future trusted composition root must first validate the input against the exact pinned capability/action adapter schema, then call `digestCanonicalInput` on that validated payload. It must pass the resulting digest to Sentinel and use the same validated payload for execution. Never digest one object and execute a different or subsequently mutated object.

This helper is a deterministic integrity primitive, not authentication, authorization or encryption. It does not grant permission or replace Sentinel, exact approval matching, atomic approval consumption or audit.
