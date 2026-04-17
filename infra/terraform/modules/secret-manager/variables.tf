variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "functions_sa_email" {
  description = "Email of the functions runtime service account (granted access)"
  type        = string
}
