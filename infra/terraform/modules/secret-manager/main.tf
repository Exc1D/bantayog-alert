locals {
  # Secret shells — the NAMES and IAM are IaC; the VALUES are injected
  # out-of-band by humans via break-glass procedure per design spec §5.5.
  secret_ids = [
    "SEMAPHORE_API_KEY",
    "GLOBE_LABS_SECRET",
    "SENTRY_DSN",
    "FCM_SERVER_KEY",
    "SMS_MSISDN_HASH_SALT",
    "SMS_WEBHOOK_INBOUND_SECRET",
  ]
}

resource "google_secret_manager_secret" "shells" {
  for_each = toset(local.secret_ids)

  project   = var.project_id
  secret_id = each.value

  replication {
    auto {}
  }

  labels = {
    managed_by = "terraform"
    injected   = "human_breakglass"
  }
}

resource "google_secret_manager_secret_iam_member" "functions_access" {
  for_each = google_secret_manager_secret.shells

  project   = each.value.project
  secret_id = each.value.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${var.functions_sa_email}"
}
