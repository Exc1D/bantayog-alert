output "dead_letter_topic_names" {
  description = "Names of dead-letter Pub/Sub topics"
  value       = [for t in google_pubsub_topic.dead_letters : t.name]
}
