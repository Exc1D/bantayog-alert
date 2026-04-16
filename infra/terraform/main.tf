terraform {
  required_version = ">= 1.5.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }

  backend "gcs" {
    # Configured per environment via -backend-config
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# BigQuery dataset for audit export
resource "google_bigquery_dataset" "audit" {
  dataset_id = "audit"
  location   = var.region

  default_table_expiration_ms = null

  labels = {
    environment = var.environment
    managed_by  = "terraform"
  }
}

# BigQuery dataset for hazard analytics (Phase: Geoanalytics)
resource "google_bigquery_dataset" "hazards" {
  dataset_id = "hazards"
  location   = var.region

  labels = {
    environment = var.environment
    managed_by  = "terraform"
  }
}