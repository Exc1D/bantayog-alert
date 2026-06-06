resource "google_logging_metric" "audit_export_failure_count" {
  project = var.project_id
  name    = "bantayog/audit_export_failure_count"
  filter  = "resource.type=\"cloud_function\" resource.labels.function_name=\"auditExportBatch\" severity>=ERROR"

  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    unit        = "1"
  }
}

resource "google_logging_metric" "test_alert_trigger" {
  project = var.project_id
  name    = "bantayog/test_alert_trigger"
  filter  = "resource.type=\"cloud_function\" jsonPayload.event=\"SYNTHETIC_ALERT_TEST\""

  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    unit        = "1"
  }
}
