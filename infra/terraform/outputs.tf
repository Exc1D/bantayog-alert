output "audit_dataset_id" {
  value = google_bigquery_dataset.audit.dataset_id
}

output "hazards_dataset_id" {
  value = google_bigquery_dataset.hazards.dataset_id
}