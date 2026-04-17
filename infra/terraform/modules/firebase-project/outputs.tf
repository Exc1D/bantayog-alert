output "enabled_apis" {
  description = "List of enabled GCP API services"
  value       = [for s in google_project_service.enabled : s.service]
}
