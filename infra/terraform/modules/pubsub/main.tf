locals {
  # Dead-letter topics for resilient event processing.
  # 30-day retention aligns with spec §9 audit requirements.
  dead_letter_topics = [
    "reports-dead-letter",
    "sms-inbound-dead-letter",
  ]
}

resource "google_pubsub_topic" "dead_letters" {
  for_each = toset(local.dead_letter_topics)

  project                    = var.project_id
  name                       = each.value
  message_retention_duration = "2592000s" # 30 days

  labels = {
    managed_by = "terraform"
    purpose    = "dead_letter"
  }
}
