# Service account used by Cloud Functions at runtime.
resource "google_service_account" "functions" {
  project      = var.project_id
  account_id   = "bantayog-functions"
  display_name = "Bantayog Cloud Functions runtime (${var.env})"
  description  = "Runtime SA for all Cloud Functions. Grants Firestore (datastore.user), FCM (firebasenotifications.admin), Secret Manager (secretmanager.secretAccessor)."
}

# Service account used by CI to deploy (Firebase Hosting, Functions, rules).
resource "google_service_account" "ci_deploy" {
  project      = var.project_id
  account_id   = "bantayog-ci-deploy"
  display_name = "Bantayog CI deploy (${var.env})"
  description  = "Used by GitHub Actions to deploy hosting, rules, and functions."
}

# Functions SA — minimal least-privilege bindings per spec §10.
# NOTE: roles/datastore.user is project-wide because Firestore does not support
# collection-level IAM conditions. Firestore Security Rules are the primary
# access control layer. This SA can technically read/write all collections,
# but rules enforce per-collection access. Review when GCP adds finer-grained
# Firestore IAM (tracked as H-10 remediation).
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

resource "google_project_iam_member" "functions_bigquery_editor" {
  project = var.project_id
  role    = "roles/bigquery.dataEditor"
  member  = "serviceAccount:${google_service_account.functions.email}"
}

resource "google_project_iam_member" "functions_storage_creator" {
  project = var.project_id
  role    = "roles/storage.objectCreator"
  member  = "serviceAccount:${google_service_account.functions.email}"
}

resource "google_project_iam_member" "functions_pubsub_publisher" {
  project = var.project_id
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${google_service_account.functions.email}"
}

# CI deploy SA — deployment-only roles (least privilege).
# Removed firebase.admin to prevent CI compromise from granting full Firebase access
# (manage users, read/write all Firestore data). CI only needs to deploy hosting,
# rules, and functions.
resource "google_project_iam_member" "ci_firebase_hosting_admin" {
  project = var.project_id
  role    = "roles/firebasehosting.admin"
  member  = "serviceAccount:${google_service_account.ci_deploy.email}"
}

resource "google_project_iam_member" "ci_firebase_rules_admin" {
  project = var.project_id
  role    = "roles/firebaserules.admin"
  member  = "serviceAccount:${google_service_account.ci_deploy.email}"
}

resource "google_project_iam_member" "ci_firestore_admin" {
  project = var.project_id
  role    = "roles/datastore.owner"
  member  = "serviceAccount:${google_service_account.ci_deploy.email}"
}

resource "google_project_iam_member" "ci_functions_developer" {
  project = var.project_id
  role    = "roles/cloudfunctions.developer"
  member  = "serviceAccount:${google_service_account.ci_deploy.email}"
}

resource "google_service_account_iam_member" "ci_sa_impersonate_functions" {
  service_account_id = google_service_account.functions.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.ci_deploy.email}"
}
