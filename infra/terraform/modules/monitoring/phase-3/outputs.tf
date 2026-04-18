output "function_error_alert_id" {
  value = google_monitoring_alert_policy.function_error_rate.id
}

output "sweep_alert_id" {
  value = google_monitoring_alert_policy.sweep_alert.id
}
