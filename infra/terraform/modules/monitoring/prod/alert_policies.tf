resource "google_monitoring_alert_policy" "functions_error_rate" {
  project      = var.project_id
  display_name = "Bantayog: Cloud Functions error rate elevated"
  combiner     = "OR"
  enabled      = true

  conditions {
    display_name = "Function execution errors > 5 per 5 min"
    condition_threshold {
      filter          = "resource.type=\"cloud_function\" AND metric.type=\"cloudfunctions.googleapis.com/function/execution_count\" AND metric.labels.status=\"error\""
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 5
      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_SUM"
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.backend_oncall.id]
  alert_strategy { auto_close = "1800s" }
}

resource "google_monitoring_alert_policy" "sms_dead_letter" {
  project      = var.project_id
  display_name = "Bantayog: SMS dead-letter queue growing"
  combiner     = "OR"
  enabled      = true

  conditions {
    display_name = "SMS dead-letter count > 3 in 15 min"
    condition_threshold {
      filter          = "metric.type=\"logging.googleapis.com/user/bantayog/sms_dead_letter_count\""
      duration        = "900s"
      comparison      = "COMPARISON_GT"
      threshold_value = 3
      aggregations {
        alignment_period   = "900s"
        per_series_aligner = "ALIGN_SUM"
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.ops_oncall.id]
  alert_strategy { auto_close = "3600s" }
}

resource "google_monitoring_alert_policy" "audit_export_failure" {
  project      = var.project_id
  display_name = "Bantayog: Audit export to BigQuery failing"
  combiner     = "OR"
  enabled      = true

  conditions {
    display_name = "auditExportBatch errors > 0 in 30 min"
    condition_threshold {
      filter          = "metric.type=\"logging.googleapis.com/user/bantayog/audit_export_failure_count\""
      duration        = "1800s"
      comparison      = "COMPARISON_GT"
      threshold_value = 0
      aggregations {
        alignment_period   = "1800s"
        per_series_aligner = "ALIGN_SUM"
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.compliance.id]
  alert_strategy { auto_close = "3600s" }
}

resource "google_monitoring_alert_policy" "test_alert" {
  project      = var.project_id
  display_name = "Bantayog: Synthetic test alert (staging validation only)"
  combiner     = "OR"
  enabled      = true

  conditions {
    display_name = "Test trigger metric > 0"
    condition_threshold {
      filter          = "metric.type=\"logging.googleapis.com/user/bantayog/test_alert_trigger\""
      duration        = "0s"
      comparison      = "COMPARISON_GT"
      threshold_value = 0
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_SUM"
      }
    }
  }

  notification_channels = [
    google_monitoring_notification_channel.backend_oncall.id,
    google_monitoring_notification_channel.ops_oncall.id,
  ]
  alert_strategy { auto_close = "300s" }
}
