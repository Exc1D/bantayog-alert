# Bantayog Terraform

Infrastructure-as-code for Bantayog Alert GCP projects.

## Scope

- Enable required Firebase/GCP APIs
- Create service accounts (Cloud Functions runtime, CI deploy)
- Provision secret shells in Secret Manager (values injected by humans)
- Provision dead-letter Pub/Sub topics

**Out of scope (handled elsewhere):** Firestore rules/indexes (Firebase CLI), Cloud Functions code deploy (Firebase CLI), Firestore database creation (Firebase CLI at enable-time).

## Prerequisites

- Terraform >= 1.8
- GCP project pre-created (manually via console or `gcloud projects create`)
- GCS state bucket pre-created (see "State Bootstrap" below)
- `gcloud auth application-default login` run locally

## State Bootstrap (one-time, per environment)

The Terraform state bucket cannot be managed by the same Terraform that uses it as a backend. Create it manually once:

```bash
# For dev
gcloud storage buckets create gs://bantayog-tf-state-dev \
  --project=bantayog-alert-dev \
  --location=asia-southeast1 \
  --uniform-bucket-level-access \
  --public-access-prevention

# Enable versioning for state recovery
gcloud storage buckets update gs://bantayog-tf-state-dev \
  --versioning
```

Repeat for `bantayog-tf-state-staging` and `bantayog-tf-state-prod` when those projects are provisioned.

## Per-environment init

```bash
# Dev
cd infra/terraform
terraform init -backend-config=envs/dev/backend.hcl

# Plan
terraform plan -var-file=envs/dev/terraform.tfvars

# Apply (requires explicit approval; not done in Phase 0)
terraform apply -var-file=envs/dev/terraform.tfvars
```

## Provider version reproducibility

`.terraform.lock.hcl` is committed for deterministic provider versions. If you update provider versions in `versions.tf`, regenerate the lock with:

```bash
terraform init -backend=false -upgrade
git add .terraform.lock.hcl
```

## Secret value injection

After `terraform apply` creates secret shells, inject values via break-glass procedure:

```bash
echo -n "ACTUAL_VALUE" | gcloud secrets versions add SEMAPHORE_API_KEY \
  --data-file=- \
  --project=bantayog-alert-dev
```

Secret values are NEVER in git, NEVER in Terraform state, NEVER in CI logs.

## Phase 0 scope

**No `terraform apply` runs as part of Phase 0.** Phase 0 delivers:

- Code lands
- `terraform init -backend=false` runs to generate `.terraform.lock.hcl`
- `terraform validate` passes for all three envs
- `terraform fmt -check` passes

Actual applies happen in a follow-on human-approved task.
