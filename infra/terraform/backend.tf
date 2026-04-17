terraform {
  backend "gcs" {
    # Configured per-env via `terraform init -backend-config=envs/<env>/backend.hcl`
  }
}
