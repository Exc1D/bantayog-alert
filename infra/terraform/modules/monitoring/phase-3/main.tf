resource "google_logging_metric" "inbox_processed" {
  name    = "phase3_inbox_processed_${var.environment}"
  project = var.project_id
  filter  = "jsonPayload.code=\"INBOX_MATERIALIZED\""
  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
  }
}

resource "google_logging_metric" "function_errors" {
  name    = "phase3_function_errors_${var.environment}"
  project = var.project_id
  filter  = "severity=\"ERROR\" AND jsonPayload.code:* AND (resource.type=\"cloud_function\" OR resource.type=\"cloud_run_revision\")"
  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
  }
}

resource "google_logging_metric" "sweep_heavy" {
  name    = "phase3_sweep_heavy_${var.environment}"
  project = var.project_id
  filter  = "jsonPayload.code=\"INBOX_RECONCILIATION_RETRY_FAILED\" AND severity=\"WARNING\""
  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
  }
}

resource "google_monitoring_alert_policy" "function_error_rate" {
  project      = var.project_id
  display_name = "[P3] Function error rate high (${var.environment})"
  combiner     = "OR"
  conditions {
    display_name = "errors > 1% sustained 10min"
    condition_threshold {
      filter          = "metric.type=\"logging.googleapis.com/user/${google_logging_metric.function_errors.name}\""
      duration        = "600s"
      comparison      = "COMPARISON_GT"
      threshold_value = 5
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_SUM"
      }
    }
  }
  notification_channels = var.notification_channel_ids
}

resource "google_monitoring_alert_policy" "sweep_alert" {
  project      = var.project_id
  display_name = "[P3] Inbox reconciliation sweep heavy (${var.environment})"
  combiner     = "OR"
  conditions {
    display_name = "sweep flagged ERROR"
    condition_threshold {
      filter          = "metric.type=\"logging.googleapis.com/user/${google_logging_metric.sweep_heavy.name}\""
      duration        = "0s"
      comparison      = "COMPARISON_GT"
      threshold_value = 0
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_SUM"
      }
    }
  }
  notification_channels = var.notification_channel_ids
}

resource "google_logging_metric" "dispatch_created" {
  name        = "${var.env}-bantayog-dispatch-created"
  description = "Count of dispatches created via dispatchResponder"
  filter      = "resource.type=\"cloud_function\" AND jsonPayload.event=\"dispatch.created\" OR resource.type=\"cloud_run_revision\" AND jsonPayload.event=\"dispatch.created\""
  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    unit        = "1"
    labels {
      key         = "municipality_id"
      value_type  = "STRING"
      description = "Municipality the dispatch was created in"
    }
  }
  label_extractors = {
    "municipality_id" = "EXTRACT(jsonPayload.municipalityId)"
  }
}
