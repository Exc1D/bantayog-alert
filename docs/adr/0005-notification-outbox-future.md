# ADR 0005: Notification Outbox Future

## Status

Accepted

## Context

Incident and dispatch commands should not be tightly coupled to every delivery
channel. Provider failures must not corrupt lifecycle state.

## Decision

Notifications should eventually use an outbox/adapter architecture. Do not
tightly couple FCM, SMS, email, or future CAP-style integrations directly into
report/dispatch command logic.

Future shape:

```text
notifications/
  outbox/
  adapters/
    fcm
    sms
    email
    console
```

## Consequences

- Notifications become retryable and auditable.
- SMS/FCM/provider failure does not corrupt incident state.
- Extra implementation work is deferred until needed.
- Command handlers must expose enough event data for a future outbox.
