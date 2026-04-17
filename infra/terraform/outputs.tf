output "project_id" {
  description = "GCP project ID"
  value       = var.project_id
}

output "env" {
  description = "Environment identifier"
  value       = var.env
}

output "functions_sa_email" {
  description = "Functions runtime service account email"
  value       = module.iam.functions_sa_email
}

output "ci_deploy_sa_email" {
  description = "CI deploy service account email"
  value       = module.iam.ci_deploy_sa_email
}

output "enabled_apis" {
  description = "Enabled GCP API services"
  value       = module.firebase_project.enabled_apis
}

output "secret_ids" {
  description = "Managed secret shell IDs"
  value       = module.secret_manager.secret_ids
}

output "dead_letter_topics" {
  description = "Dead-letter Pub/Sub topic names"
  value       = module.pubsub.dead_letter_topic_names
}
