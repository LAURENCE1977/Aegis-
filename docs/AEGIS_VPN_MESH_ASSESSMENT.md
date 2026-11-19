# AEGIS VPN and Private Mesh Assessment — 16 November 2026

Status: targeted architecture, official-documentation and licence assessment. This is not a full source-code, cryptographic, dependency, mobile-client or penetration audit. No software was installed, executed, connected, or deployed.

## Executive decision

AEGIS must keep two separate capabilities:

1. **Privacy VPN / internet exit:** routes selected device traffic through a VPN gateway. The gateway operator can observe metadata and unencrypted destination traffic; a VPN does not make a person anonymous, stop malware, or protect traffic outside its tunnel.
2. **Private device mesh:** creates authenticated encrypted connections between a user's own devices and services. This is for private access to AEGIS nodes, home devices and self-hosted services; it is not automatically a general-purpose privacy VPN.

Use WireGuard as the established tunnel technology where supported. AEGIS must not design its own cryptographic protocol. AEGIS owns identity, policy, user experience, approvals, audit and provider abstraction; the selected networking engine remains a replaceable adapter.

**No final vendor/platform selection yet.** Headscale is the leaner self-hosted control-plane candidate; NetBird is the more integrated management candidate. Both deserve an isolated proof-of-concept before a decision. Neither is approved as a mandatory AEGIS dependency.

## Candidate comparison

### WireGuard

- Role: encrypted tunnel protocol and implementations, not a complete mesh-management or consumer VPN-provider service.
- Official installation documentation lists Windows, macOS, Linux distributions, Android and iOS clients/packages.
- Strength: established, purpose-built tunnel technology with broad platform availability.
- Limitation: key distribution, device enrolment, access policy, DNS, exit gateway, relay/NAT traversal, user support and operational monitoring must be supplied by surrounding components.
- AEGIS decision: preferred protocol foundation; use maintained platform implementations and never invent cryptography.

Primary source: https://www.wireguard.com/install/

### Headscale

- Role: self-hosted implementation of the Tailscale control server, intentionally aimed at an individual or small organisation's single private network.
- Root licence: BSD-3-Clause.
- Official feature documentation lists node registration, DNS/MagicDNS, subnet routes, exit nodes, ACLs/grants, dual-stack networking and relay options.
- Strength: relatively narrow and lightweight control-plane scope; suitable to investigate for a low-cost, owner-operated private mesh.
- Limitation: it is a control server, not a complete consumer VPN provider. Its usual client ecosystem is Tailscale-compatible; the Headscale README notes that Tailscale GUI clients for proprietary operating systems (including iOS/macOS) are not all open source. Do not claim an entirely open-source end-to-end mobile stack.
- Operational concern: self-hosting still needs a reachable control endpoint and a relay strategy. Public DERP relay use and embedded/self-hosted relay options need privacy, availability and cost review.
- AEGIS disposition: **preferred lightweight mesh control-plane candidate for first POC**, not yet selected for production. Test exact iOS, Android, ChromeOS/Linux and desktop enrolment and recovery paths.

Primary sources:
- https://github.com/juanfont/headscale
- https://github.com/juanfont/headscale/blob/main/LICENSE
- https://headscale.net/stable/about/features/

### NetBird

- Role: self-hosted WireGuard-based mesh with management, signal and relay services, user/device identity, access controls and dashboard.
- Licensing is mixed: repository root states BSD-3-Clause for most code, while management, signal, relay and combined server directories are AGPL-3.0. Review the exact release tree and dependencies before distribution or modification.
- Official self-host guide currently documents a Linux VM with at least 1 CPU and 2 GB RAM, a public domain, TCP 443 and UDP 3478 (port 80 behaviour depends on the selected TLS setup).
- Strength: more integrated administration and user-facing management than Headscale; supports private network routes and exit-node patterns.
- Limitation: larger operational footprint; mixed AGPL/BSD licensing; self-hosting requires public infrastructure and ongoing updates. Exit-node routes need explicit access-control review: NetBird documentation warns that routed networks can bypass access-control rules unless explicitly configured.
- AEGIS disposition: **strong usability/management comparison candidate**, but not default until AGPL boundaries, client coverage, route enforcement and resource costs are fully checked.

Primary sources:
- https://github.com/netbirdio/netbird
- https://github.com/netbirdio/netbird/blob/main/LICENSE
- https://docs.netbird.io/selfhosted/selfhosted-quickstart
- https://docs.netbird.io/manage/network-routes
- https://docs.netbird.io/about-netbird/how-netbird-works

## Provisional architecture recommendation

- AEGIS Network Protection interface presents two independent controls: **Protect internet traffic** and **Connect my devices**. Never imply that enabling one enables the other.
- AEGIS Network Adapter contract abstracts WireGuard-based implementations. Headscale and NetBird remain optional replaceable backends.
- Sentinel owns enrolment approvals, device trust, peer/resource scopes, route approvals, policy changes, revoke and audit.
- Vault stores private keys, enrolment tokens and provider credentials. Never expose them to model context, browser UI, logs or analytics.
- AEGIS policy is deny-by-default: a new peer has no access until approved; no broad LAN/subnet or internet-exit route without a separately reviewed grant.
- Provide visible connection state, last handshake, route and DNS status, relay/direct status where available, and clear failure messages.
- A kill switch is only advertised on platforms where the OS integration can enforce it and where fail-closed behaviour has been tested. If the tunnel drops, show whether traffic is blocked or falls back to the normal network.
- DNS leak tests, IPv4/IPv6 route checks and captive-portal handling must be tested on each supported platform.
- Support split tunnelling only with an understandable route preview and explicit consent. Never silently reroute all traffic.
- User can disconnect, revoke a device, export recovery information and remove the mesh without losing AEGIS memory or account data.

## Platform reality

- **iOS/iPadOS:** use supported Network Extension / VPN-provider APIs and platform-permitted client integration. Do not promise arbitrary packet inspection, global firewall control or an always-on kill switch from a normal app. Validate App Store entitlements and background behaviour.
- **Android:** VPNService offers a stronger integration path, but only one active VPN service can generally own the system VPN slot at a time; compatibility with other VPN/security apps must be handled.
- **ChromeOS:** Linux container support does not equal host-wide VPN control. Validate managed/consumer Chromebook behaviour and whether the selected client can protect all host traffic.
- **Desktop/Linux:** more flexible route/firewall integration, but requires privileged components, signed updates, least-privilege services and recovery from broken routes.
- **Cloudflare Workers/Pages:** not a place to run a WireGuard tunnel daemon or privileged network interface. Keep AEGIS control plane separate from network data plane.

These are design constraints; exact OS API and store-policy validation remains a required platform-specific engineering task.

## POC acceptance plan — before choosing

Run only on isolated test devices and a test server, with no production user traffic:

1. Enrol and revoke one Linux/desktop peer and one mobile peer; prove revoked peers cannot reconnect.
2. Verify peer-to-peer direct path and relay fallback under restrictive NAT; record connection success, latency and throughput.
3. Test subnet access and exit-node routing separately; prove default-deny ACLs and no unintended LAN access.
4. Test DNS, IPv4 and IPv6 leak behaviour during normal operation, tunnel interruption, sleep/wake, network switching and captive portals.
5. Test kill-switch behaviour only where OS-supported; verify both fail-closed and user recovery.
6. Measure idle/peak RAM, CPU, battery, bandwidth, startup, reconnect, server storage and ongoing administration.
7. Test backup/restore, key rotation, device loss, control-plane outage and recovery.
8. Audit exact release source, dependency licences, mobile client provenance, update/signature process, vulnerability history and telemetry.
9. Compare Headscale and NetBird against a direct WireGuard configuration baseline; do not assume the management plane is always needed.
10. Record all platform gaps and total cost. No paid VPS, domain, relay, commercial VPN subscription or cloud deployment is provisioned without explicit owner approval.

## Decision gates

- Headscale wins if it meets usability and cross-platform requirements with materially lower resource/operational burden and acceptable client openness.
- NetBird wins only if its dashboard/identity/policy advantages materially improve user experience and its AGPL deployment boundary is acceptable.
- Plain WireGuard wins for a simple owner-operated exit tunnel if AEGIS can safely manage keys and OS integration without adding a full mesh control plane.
- Reject either candidate if it requires weakening Sentinel, exposing secrets, broad default routes, unreviewed third-party relays, unbounded privilege, mandatory paid services or unsupported platform claims.

## Research evidence and caveats

The official sources above establish project roles, stated feature sets, root licensing and documented self-host requirements. A recent third-party comparison reports low idle resource use in a small lab for both products, but its measurements are not independently reproduced here and must not be used as AEGIS sizing guarantees: https://rscomputers-ks.com/headscale-vs-netbird-self-hosted/

This document is a focused research record only. It does not constitute a full REA of either repository, a cryptographic audit, legal advice, a production recommendation, or an implementation. Full REA must pin exact release commits and inspect source, dependencies, mobile clients, build/release pipelines, security reports, tests and runtime behaviour before adoption.

Last updated: 16 November 2026.
