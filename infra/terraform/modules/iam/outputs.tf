output "functions_sa_email" {
  description = "Email of the functions runtime service account"
  value       = google_service_account.functions.email
}

output "ci_deploy_sa_email" {
  description = "Email of the CI deploy service account"
  value       = google_service_account.ci_deploy.email
}
