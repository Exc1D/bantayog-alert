variable "project_id" {
  description = "GCP project ID (e.g., bantayog-alert-dev)"
  type        = string
}

variable "project_number" {
  description = "GCP project number (used for IAM bindings)"
  type        = string
  validation {
    condition     = can(regex("^[0-9]+$", var.project_number))
    error_message = "project_number must be numeric (bootstrap placeholder must be replaced before apply)"
  }
  validation {
    condition     = var.project_number != "REPLACE_WITH_PROJECT_NUMBER_AT_BOOTSTRAP"
    error_message = "project_number is still the bootstrap placeholder — replace with real value before apply"
  }
}

variable "region" {
  description = "Primary GCP region"
  type        = string
  default     = "asia-southeast1"
}

variable "env" {
  description = "Environment identifier"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.env)
    error_message = "env must be dev, staging, or prod"
  }
}

variable "state_bucket" {
  description = "GCS bucket for Terraform state (must exist before init)"
  type        = string
}
