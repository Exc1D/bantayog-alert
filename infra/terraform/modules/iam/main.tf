# Service account used by Cloud Functions at runtime.
resource "google_service_account" "functions" {
  project      = var.project_id
  account_id   = "bantayog-functions"
  display_name = "Bantayog Cloud Functions runtime (${var.env})"
  description  = "Runtime SA for all Cloud Functions. Grants read/write to Firestore, Storage, FCM, Secret Manager."
}

# Service account used by CI to deploy (Firebase Hosting, Functions, rules).
resource "google_service_account" "ci_deploy" {
  project      = var.project_id
  account_id   = "bantayog-ci-deploy"
  display_name = "Bantayog CI deploy (${var.env})"
  description  = "Used by GitHub Actions to deploy hosting, rules, and functions."
}

# Functions SA — minimal least-privilege bindings per spec §10.
# Datastore user for Firestore read/write. FCM for push. Storage object admin
# scoped to the media bucket (not project-wide).
resource "google_project_iam_member" "functions_datastore" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.functions.email}"
}

resource "google_project_iam_member" "functions_secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.functions.email}"
}

resource "google_project_iam_member" "functions_fcm_sender" {
  project = var.project_id
  role    = "roles/firebasenotifications.admin"
  member  = "serviceAccount:${google_service_account.functions.email}"
}

# CI deploy SA — Firebase admin roles scoped to what deploys need.
resource "google_project_iam_member" "ci_firebase_admin" {
  project = var.project_id
  role    = "roles/firebase.admin"
  member  = "serviceAccount:${google_service_account.ci_deploy.email}"
}

resource "google_project_iam_member" "ci_functions_developer" {
  project = var.project_id
  role    = "roles/cloudfunctions.developer"
  member  = "serviceAccount:${google_service_account.ci_deploy.email}"
}

resource "google_project_iam_member" "ci_sa_user" {
  project = var.project_id
  role    = "roles/iam.serviceAccountUser"
  member  = "serviceAccount:${google_service_account.ci_deploy.email}"
}
