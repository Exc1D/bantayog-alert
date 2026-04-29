resource "google_monitoring_notification_channel" "backend_oncall" {
  project      = var.project_id
  display_name = "Backend On-Call"
  type         = "email"
  labels       = { email_address = var.oncall_backend_email }
  enabled      = true
}

resource "google_monitoring_notification_channel" "ops_oncall" {
  project      = var.project_id
  display_name = "Ops On-Call"
  type         = "email"
  labels       = { email_address = var.oncall_ops_email }
  enabled      = true
}

resource "google_monitoring_notification_channel" "compliance" {
  project      = var.project_id
  display_name = "Compliance"
  type         = "email"
  labels       = { email_address = var.oncall_compliance_email }
  enabled      = true
}

output "backend_channel_id" {
  value = google_monitoring_notification_channel.backend_oncall.id
}

output "ops_channel_id" {
  value = google_monitoring_notification_channel.ops_oncall.id
}
