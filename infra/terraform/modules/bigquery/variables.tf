variable "project_id" {
  type        = string
  description = "GCP project ID"
}

variable "location" {
  type        = string
  default     = "asia-southeast1"
  description = "BigQuery dataset location"
}
