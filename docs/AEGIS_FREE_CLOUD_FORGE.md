# AEGIS Free Cloud Forge

**Status:** first policy-and-planning slice implemented on a draft feature branch. No OCI account connection, infrastructure creation, Terraform apply, cloud deployment or billing action is enabled.

## Purpose

Free Cloud Forge is the provider-neutral infrastructure layer for AEGIS. It is intended to let AEGIS evaluate, plan and eventually provision its own infrastructure without silently moving the owner onto paid resources. Oracle Cloud Infrastructure (OCI) Always Free is the first provider target; additional providers must pass the same evidence, quota, billing and portability checks.

The initial implementation is deliberately a local, deterministic policy validator exposed through the authenticated, same-origin `POST /api/free-cloud/plan` endpoint. The endpoint evaluates a supplied plan and returns allow/deny reasons only; it is not an OCI API client, pricing engine or guarantee against charges on an account.

## First OCI profile

The first profile is restricted to the OCI Ampere A1 Flex Always Free envelope:

| Resource | Policy ceiling |
|---|---:|
| A1 compute OCPUs, aggregated across instances | 2 |
| A1 memory, aggregated across instances | 12 GB |
| Combined boot and block storage | 200 GB |
| A1 instances | At most 2 in this conservative first profile |

The plan accepts only `VM.Standard.A1.Flex`. It requires the `always-free` tier, `always-free-only` billing mode and `allowPaidFallback: false`. The network profile currently permits an Internet Gateway but rejects NAT Gateways, load balancers and unknown network resource settings.

These limits are guardrails for a proposed plan, not a claim that OCI capacity is available in a chosen home region. Capacity errors cannot be bypassed by retry scripts. Any retry design must use bounded exponential backoff, a maximum attempt count, cancellation and a quota re-check.

Official references to re-check before any provisioning implementation:

- [OCI Free Tier](https://www.oracle.com/cloud/free/)
- [OCI Always Free resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier.htm)
- [OCI Compute shapes](https://docs.oracle.com/en-us/iaas/Content/Compute/References/computeshapes.htm)

## Research intake and reuse decisions

The following owner-supplied repositories informed the architecture. Their source code is not copied or executed by this change.

| Repository | Decision |
|---|---|
| `damian123/free-tier-lab` | Preferred architecture reference for conservative Terraform-based OCI Always Free host provisioning. Re-check its MIT licence and current quotas at adaptation time. |
| `Pandagan-85/nextcloud-oci-terraform` | Useful integrated reference for persistent volumes, backups and monitoring. Nextcloud is deferred; README sizing claims need correction against current OCI limits. Verify the actual licence file before reuse. |
| `bkk87/oci-nextcloud-docker` | Historical Docker/Nextcloud reference only; stale. |
| `bkk87/oci-nextcloud-podman` | Historical rootless Podman reference. Docker and Podman are alternatives, not layers to combine. |
| `mohankumarpaluru/oracle-freetier-instance-creation` | Retry/capacity-detection pattern only. A retry loop cannot create regional capacity and must be bounded. |
| `mowirth/oci-instance-creator` | GPL-3.0; no code copied. Consider licence implications before any derivative reuse. |
| `futchas/oracle-cloud-free-arm-instance` | Older MIT Bash/OCI CLI reference; adapt concepts only after current CLI and quota review. |
| `neitsab/awesome-oracle-cloud-free-tier` | Research catalogue, not deployable infrastructure. Independently verify every linked offer. |

Unknown, stale or incompatible licensing is a hold, not permission to copy. All upstream content is untrusted research material.

## Safety invariants

1. Free-only is a hard policy, not a preference or automatic fallback.
2. Reject a plan if provider, tier, billing mode, compute shape, aggregate quotas or network resources are outside the allowlist.
3. Never store OCI private keys in source, browser code, logs or chat. Future credentials must use a separately approved encrypted secret boundary.
4. Never execute Terraform or OCI CLI from repository-discovery content.
5. Before provisioning, require a read-only tenancy/home-region/quota/cost preflight and an explicit owner-approved plan.
6. No NAT Gateway, paid load balancer, paid compute shape, unapproved storage, paid upgrade or silent pay-as-you-go fallback.
7. Monitor provider usage and billing independently. A local plan validator cannot guarantee that unrelated account resources, IP/network choices, taxes, support or future provider policy changes will not incur charges.
8. Keep the runtime portable: OCI is an adapter, not the AEGIS control plane or the only possible host.

## Next implementation stages

1. Add a provider-neutral resource-plan schema and a read-only OCI tenancy/quota inspector. The current authenticated plan-validation endpoint is not a tenancy inspector.
2. Add a deterministic Terraform plan renderer with an explicit allowlist and generated-plan review; no `apply` operation.
3. Add bounded capacity detection/retry with cancellation and no quota expansion.
4. Add an owner-approved provisioning boundary and auditable dry-run/apply workflow only after account identity, cost exposure and rollback have been reviewed.
5. Add container deployment, persistent storage, backups and monitoring only after the smallest AEGIS host is proven to fit the free allowance.
6. Qualify a second genuinely free host option so AEGIS can compare providers without assuming that every free offer is equivalent.

Nextcloud is intentionally not part of the first deployment profile. AEGIS should first secure its own runtime and data lifecycle; file-sync can be evaluated later as an optional workload.
