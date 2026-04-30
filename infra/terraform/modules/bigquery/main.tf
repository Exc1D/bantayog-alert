resource "google_bigquery_dataset" "audit" {
  dataset_id                 = "bantayog_audit"
  project                    = var.project_id
  location                   = var.location
  delete_contents_on_destroy = false
}

resource "google_bigquery_table" "streaming_events" {
  dataset_id          = google_bigquery_dataset.audit.dataset_id
  table_id            = "streaming_events"
  project             = var.project_id
  deletion_protection = true

  schema = jsonencode([
    { name = "event_type", type = "STRING", mode = "REQUIRED" },
    { name = "actor_uid", type = "STRING", mode = "REQUIRED" },
    { name = "session_id", type = "STRING", mode = "NULLABLE" },
    { name = "target_collection", type = "STRING", mode = "NULLABLE" },
    { name = "target_document_id", type = "STRING", mode = "NULLABLE" },
    { name = "metadata", type = "STRING", mode = "NULLABLE" },
    { name = "occurred_at", type = "INTEGER", mode = "REQUIRED" },
    { name = "inserted_at", type = "TIMESTAMP", mode = "NULLABLE" }
  ])
}

resource "google_bigquery_table" "batch_events" {
  dataset_id          = google_bigquery_dataset.audit.dataset_id
  table_id            = "batch_events"
  project             = var.project_id
  deletion_protection = true

  schema = jsonencode([
    { name = "log_name", type = "STRING", mode = "REQUIRED" },
    { name = "resource", type = "STRING", mode = "NULLABLE" },
    { name = "payload", type = "STRING", mode = "NULLABLE" },
    { name = "timestamp", type = "TIMESTAMP", mode = "NULLABLE" }
  ])
}
