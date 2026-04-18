variable "project_id" {
  type        = string
  description = "GCP project ID (staging or prod)."
}

variable "environment" {
  type        = string
  description = "Environment name (dev, staging, prod)."
}

variable "notification_channel_ids" {
  type        = list(string)
  description = "Cloud Monitoring notification channel IDs."
  default     = []
}
