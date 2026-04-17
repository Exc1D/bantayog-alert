output "secret_ids" {
  description = "IDs of managed secret shells"
  value       = [for s in google_secret_manager_secret.shells : s.secret_id]
}
