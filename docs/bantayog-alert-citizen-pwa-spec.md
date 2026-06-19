# Bantayog Alert Citizen PWA

## Unified Experience, Interaction, Content, and MVP Specification

| Field            | Value                                                                                                                      |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Document status  | Proposed implementation specification                                                                                      |
| Version          | 2.0                                                                                                                        |
| Date             | June 19, 2026                                                                                                              |
| Product surface  | Citizen-facing Progressive Web App                                                                                         |
| Primary audience | Product, UX, frontend, backend, QA, operations, content, and thesis evaluators                                             |
| Scope            | Citizen Home, public safety information, incident reporting, report tracking, offline behavior, privacy, and accessibility |

---

## 1. Executive Summary

Bantayog Alert Citizen PWA is a high-stakes public-service product. It must not behave like a generic government portal, a social network, a municipal statistics dashboard, or a gamified reporting application.

Its emotional target is:

> **Calm, agency, reassurance, and institutional trust—not delight for its own sake.**

The product must help a resident do three things:

1. **Understand what matters nearby now.**
2. **Report an incident safely and efficiently.**
3. **See what the local government has actually recorded in response.**

The experience is organized around three connected product patterns.

### 1.1 Your Local Brief

**Your Local Brief** is the Home experience.

> A concise, location-aware interpretation of official alerts, weather impacts, nearby verified incidents, and relevant report updates.

It answers:

> **What should I know or do right now?**

Home must not become a grid of equally weighted cards. It should behave like a short public-safety briefing with a clear priority order, a visible location, exact freshness information, and one dominant next action when action is required.

### 1.2 The Visible Response

**The Visible Response** is the end-to-end service model for citizen reports.

Every report moves through three forms:

1. **A concern** — the citizen describes what is happening.
2. **A recognized case** — the backend confirms receipt and creates a permanent tracking record.
3. **A visible response** — confirmed government actions remain understandable until the case reaches an ending.

It answers:

> **Did my concern enter the response system, and what is happening to it?**

### 1.3 The Response Thread

**The Response Thread** is the primary tracking interface that makes the Visible Response understandable.

> **From report to response, every confirmed step remains visible.**

It connects local draft creation, delivery, review, assignment, response, and closure without implying progress that the system has not confirmed.

### 1.4 Unified product promise

> **Know what is happening around you. Report what needs attention. See what happens next.**

A shorter internal positioning statement is:

> **Local awareness and accountable response, in one calm citizen experience.**

---

## 2. Product Goals

### 2.1 Primary goals

Citizen PWA must:

1. Give residents a clear local brief based on a location they can see, understand, and change.
2. Surface urgent official instructions before routine information.
3. Help a citizen submit an actionable incident report quickly under stress.
4. Target a median essential-path reporting time of under two minutes.
5. Make it unmistakable whether a report is saved locally, queued, sending, failed, or received by the server.
6. Translate operational statuses into plain-language explanations.
7. Tell the citizen whether another action is required.
8. Preserve entered information through interruptions, validation failures, unstable connectivity, and optional upload failures.
9. Provide an understandable ending for every report.
10. Expose only citizen-safe information while preserving meaningful transparency.
11. Work on low-end phones, small screens, slow networks, intermittent connections, and assistive technologies.
12. Explain uncertainty, stale data, and unavailable information instead of hiding them.

### 2.2 Desired citizen outcomes

After using Citizen PWA, a citizen should be able to answer:

- Which location is the app using?
- Is there an urgent official instruction for that location?
- Is weather likely to affect travel or safety?
- Is there a relevant verified incident nearby?
- Did the system receive my report?
- What is happening to my report now?
- What has the local office actually confirmed?
- Is a response team assigned?
- Do I need to do anything else?
- When was this information last updated?
- What was the final outcome?

### 2.3 Non-goals

The MVP is not intended to:

- replace 911, emergency hotlines, PAGASA, or national warning systems;
- guarantee a response time;
- present the app as proof that an area is completely safe;
- display private responder identities or unrestricted dispatch details;
- show unverified citizen reports as established public incidents;
- expose exact residential addresses through public incident surfaces;
- provide incident voting, popularity rankings, comments, or community reputation;
- reward report volume;
- use streaks, points, badges, or guilt-based engagement;
- create speculative arrival times or live responder tracking;
- use continuous background location tracking;
- generate public-safety summaries with an unconstrained language model;
- present queued or locally saved reports as received by government.

---

## 3. Information Architecture and Navigation

### 3.1 Primary navigation

The primary citizen navigation is:

> **Home · Map · Report · Feed · Profile**

| Destination | Purpose                                                                                                           |
| ----------- | ----------------------------------------------------------------------------------------------------------------- |
| **Home**    | Default surface. Presents Your Local Brief and the highest-priority citizen action.                               |
| **Map**     | Spatial view of verified, citizen-safe public incidents and relevant official information.                        |
| **Report**  | Prominent center action for creating or continuing an incident report.                                            |
| **Feed**    | Browsable list of verified public incidents and approved updates.                                                 |
| **Profile** | Report history, saved location, notification preferences, language, accessibility, privacy, and account settings. |

### 3.2 Navigation decisions

- **Home is the default route.**
- Map is not treated as another Home.
- Report remains visually prominent in the center of the primary navigation.
- The former Alerts destination becomes a secondary screen reached through **View all alerts** from Home.
- Report tracking may be entered from Home, Profile, a notification, a copied link, or a tracking reference.
- Emergency contacts remain available without sign-in.
- The browser Back action must preserve drafts and must not silently discard work.

### 3.3 Secondary destinations

The following screens sit outside the five primary tabs:

- Alert details
- All active alerts
- Forecast details
- Public incident details
- Report creation flow
- Report confirmation
- Report tracking
- Request-for-information response
- Emergency contacts
- Location selection
- Notification explanation and opt-in
- Privacy explanation
- Language and accessibility settings

### 3.4 Surface boundaries

Home summarizes. Map spatializes. Feed supports browsing. Report captures evidence. Profile stores personal context and history.

The same content must not be duplicated indiscriminately across all surfaces.

- Home shows at most the most relevant nearby incident.
- Feed contains the browsable incident list.
- Map shows only incidents appropriate for geographic projection.
- Tracking shows the citizen's own report in more detail than public surfaces.
- Public alert details retain the issuing authority's official content and classification.

---

## 4. Core Experience Principles

Every product, content, design, and implementation decision must follow these principles.

### 4.1 Action before information

Show the next valid action before supporting details.

### 4.2 Meaning before measurement

Explain the human or operational meaning before showing codes, measurements, probabilities, or classifications.

### 4.3 Truth before reassurance

Never imply safety, receipt, review, verification, assignment, dispatch, arrival, or resolution before the responsible source records it.

Use:

> **No active official alerts were found for Daet.**

Do not use:

> **Everything is safe.**

### 4.4 Priority before completeness

Home should show what matters most, not every available data point.

### 4.5 Progress before decoration

Motion and visual emphasis must clarify a state transition rather than merely make the product appear modern.

### 4.6 One dominant action per moment

Each state should have one clear primary action, especially during emergencies, reporting, error recovery, and requests for more information.

### 4.7 Preserve citizen effort

Drafts, descriptions, selected locations, optional contact details, and recoverable evidence must survive expected interruptions.

### 4.8 Close the loop

Every report must end with an understandable outcome, reason or recorded action, timestamp, and next valid route.

### 4.9 Care must be operational

The interface expresses empathy through reliability, privacy, plain language, preserved work, exact timestamps, and accountable updates—not through decorative slogans.

### 4.10 Attribution matters

Citizen-facing language must distinguish system facts from reports made by staff or responders.

Use:

> **The responder reported arriving at the location.**

Do not use:

> **Responders are at the location.**

unless the system independently verifies physical presence.

### 4.11 Freshness is part of meaning

The app must distinguish:

- current information;
- cached information;
- stale information;
- unavailable information;
- no active information.

These states must never look or sound identical.

### 4.12 Ethical usefulness over engagement

The product may explain the benefit of location, notifications, and report completion. It must not manipulate residents into returning, reporting more often, or enabling permissions.

---

## 5. System Truth and State Architecture

The citizen experience depends on several different sources of truth. They must remain separate in data and presentation.

### 5.1 Layer A — Information availability and freshness

This layer applies to alerts, weather, nearby incidents, and assembled briefs.

| Internal state     | Meaning                                                         | Citizen-facing pattern                                          |
| ------------------ | --------------------------------------------------------------- | --------------------------------------------------------------- |
| `current`          | Data is available within the accepted freshness window          | **Updated today at 7:12 AM**                                    |
| `cached_current`   | Cached data is still inside the accepted freshness window       | **Showing saved information updated at 7:12 AM**                |
| `stale`            | Data is available but older than the accepted threshold         | **Showing the last available update from yesterday at 8:00 PM** |
| `unavailable`      | The source could not return usable information                  | **This information could not be updated.**                      |
| `offline_no_cache` | The device is offline and no saved data exists                  | **Connect to the internet to load local information.**          |
| `empty_confirmed`  | The source was checked successfully and returned no active item | **No active official alerts were found for Daet.**              |

The interface must not represent `unavailable`, `offline_no_cache`, or `stale` as `empty_confirmed`.

### 5.2 Layer B — Device and delivery state

This layer answers:

> **Has the report left this device and reached Bantayog Alert?**

| Internal state      | Meaning                                       | Citizen-facing language                                                    |
| ------------------- | --------------------------------------------- | -------------------------------------------------------------------------- |
| `draft_local`       | Work exists only on this device               | **Your unfinished report is saved on this phone.**                         |
| `queued_offline`    | Submission is ready but cannot currently send | **Waiting for an internet connection.**                                    |
| `submitting`        | Data is being transmitted                     | **Sending your report securely.**                                          |
| `server_confirmed`  | Backend returned a permanent report record    | **Bantayog Alert received your report.**                                   |
| `submission_failed` | Delivery failed and recovery requires action  | **The report was not sent. Your information remains saved on this phone.** |

Only a backend-created permanent reference may produce `server_confirmed`.

### 5.3 Layer C — Operational response state

This layer is available only after `server_confirmed`. It answers:

> **What has the local response system recorded after receiving the report?**

| Internal state      | Citizen-facing headline                                 | Supporting explanation                                                                             |
| ------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `pending_review`    | **Waiting for local-office review**                     | The report has been received and is waiting for an authorized officer to check it.                 |
| `under_review`      | **The local office is reviewing the details**           | An authorized officer is checking the incident information and deciding the appropriate next step. |
| `needs_information` | **More information is needed**                          | The report cannot proceed until the requested detail is added or clarified.                        |
| `verified`          | **The incident details have been verified**             | The local office confirmed that the report can proceed to response coordination.                   |
| `duplicate`         | **This incident is already being handled**              | The report appears to describe an incident already recorded by the local office.                   |
| `referred`          | **This incident requires a different contact channel**  | Another service or channel is more appropriate for this concern.                                   |
| `assigned`          | **A response team has been assigned**                   | The local office sent the recorded incident details and location to a response team.               |
| `acknowledged`      | **The response team received the assignment**           | The assigned team confirmed receipt of the incident details.                                       |
| `en_route`          | **The response team reported that they are on the way** | Stay safe and keep your phone available when possible.                                             |
| `on_scene`          | **The response team reported arriving at the location** | The team is assessing or handling the incident.                                                    |
| `resolved`          | **The recorded response action has been completed**     | Review the recorded outcome below.                                                                 |
| `closed`            | **The local office has closed this report**             | No further action is currently recorded for this report.                                           |
| `unable_to_verify`  | **The local office could not verify this report**       | The available details were not enough to confirm or act on the incident.                           |

### 5.4 Layer D — Public incident eligibility

A report must not automatically become a public incident.

A report can appear on Home, Map, or Feed only when a public projection record explicitly confirms that it is:

- verified or otherwise approved for public display;
- relevant and not expired;
- generalized to a citizen-safe location;
- stripped of private identities and contact details;
- assigned an approved public status and summary;
- supported by an allowed public image, when an image is shown.

### 5.5 State precedence

When multiple items compete for attention, the interface uses this precedence:

1. Immediate official instruction affecting the selected location
2. Citizen action required on an existing report
3. Severe warning or high-significance verified nearby incident
4. Delivery failure or queued report requiring awareness
5. Routine active report update
6. Normal local brief
7. Empty, offline, stale, or unavailable explanation

A lower-priority item must not visually overpower a higher-priority safety instruction.

### 5.6 No inferred state transitions

The client must not infer operational progress from elapsed time.

Examples:

- Time since receipt does not imply review.
- Assignment does not imply departure.
- Departure does not imply arrival.
- An uploaded image does not imply verification.
- An acknowledged notification does not imply that an officer acted.

---

## 6. Home Experience — Your Local Brief

### 6.1 Purpose

Home is a short, location-aware public-safety briefing, not a municipal dashboard.

It should answer five questions quickly:

1. Is there an urgent official instruction for my location?
2. Is weather likely to affect safety or travel today?
3. Is there a relevant verified incident nearby?
4. Has anything important changed with my report?
5. What should I do next?

### 6.2 Home content order

Home uses a dynamic hierarchy rather than a fixed equal-weight card grid.

#### Priority 1 — Urgent official instruction

An emergency or evacuation alert becomes the dominant surface.

> **Move away from the riverbank now**  
> A flash-flood evacuation warning is active for affected areas of Barangay San Jose. Follow instructions from Daet MDRRMO.  
> Issued today at 3:42 PM.

Primary action:

> **View evacuation instructions**

Secondary action:

> Emergency contacts

During this state:

- the ordinary greeting becomes secondary or disappears;
- routine weather is reduced or omitted;
- the alert must include source, affected location, issued time, and current validity;
- severity must not depend on red alone.

#### Priority 2 — Citizen action required

When a report requires clarification:

> **Your report needs one more detail**  
> The local office needs a more precise location before it can continue reviewing the incident.

Primary action:

> **Add the location**

This action links directly to the relevant part of the report or Response Thread.

#### Priority 3 — Active warning or significant nearby incident

> **Road travel may be affected nearby**  
> A verified fallen-tree obstruction about 2 km from your selected area is being handled.

Primary action:

> **View incident**

#### Priority 4 — Normal daily brief

> **No active official alerts were found for Daet**  
> Rain may affect travel later this afternoon. One verified road obstruction nearby is currently being handled.

This is the normal Home state.

### 6.3 Recommended Home structure

```text
┌──────────────────────────────────────┐
│ Good morning, David             🔔   │
│ 📍 Daet, Camarines Norte       Change│
│ Updated today at 7:12 AM              │
├──────────────────────────────────────┤
│ YOUR LOCAL BRIEF                     │
│                                      │
│ No active official alerts were found │
│ for Daet. Rain may affect travel     │
│ later this afternoon.                │
│                                      │
│ [View today's details]               │
├──────────────────────────────────────┤
│ YOUR REPORT                          │
│ Flood report · Under review          │
│ No action is needed from you.        │
│ Updated at 6:48 AM                   │
│ [Track report]                       │
├──────────────────────────────────────┤
│ NEARBY                               │
│ Fallen tree · About 2 km away        │
│ Verified · Response team assigned    │
│ [View incident]                      │
├──────────────────────────────────────┤
│ TODAY'S WEATHER                      │
│ Rain may make roads slippery after   │
│ 2 PM.                                │
│ 29° / 25° · Official source          │
│ [View forecast]                      │
├──────────────────────────────────────┤
│ Emergency contacts                   │
└──────────────────────────────────────┘
```

The primary navigation continues to provide the prominent center **Report** action. Home should not duplicate it with another oversized report card unless usability testing demonstrates poor discoverability.

### 6.4 Brief composition formula

The local brief must be created from approved deterministic rules and templates.

Each brief should contain, when available:

1. Current safety interpretation
2. Most important likely consequence
3. Recommended action, when action exists
4. Location being used
5. Freshness and official source

Example:

> **Prepare for potentially difficult travel this afternoon.**  
> Heavy rain may reduce visibility in parts of Daet. Avoid flooded roads and monitor official local instructions.  
> Updated today at 11:20 AM.

The MVP must not use unrestricted AI-generated summaries. Deterministic templates are easier to approve, test, translate, audit, and correct.

### 6.5 Brief assembly rules

The brief composer must:

- select the highest applicable priority state;
- prefer official alerts over derived weather interpretations;
- avoid merging conflicting claims into one sentence;
- include no more than one dominant instruction;
- avoid absolute statements about safety;
- identify the location scope;
- expose the latest successful data timestamp;
- indicate stale or incomplete source data;
- link to source details;
- use approved wording for each state combination.

### 6.6 Greeting

A greeting may make the service feel personal, but it must remain quiet.

Use:

> **Good morning, David**

or:

> **Good morning**

During an emergency state, replace the greeting with the instruction or affected-location headline.

The selected location is more operationally important than the citizen's name.

### 6.7 Location model

Home must distinguish among:

- current device location;
- saved municipality or barangay;
- manually selected location;
- last known location;
- unavailable location.

Examples:

> **Using your current location**  
> Approximate area: Daet

> **Using your saved area**  
> Barangay III, Daet

> **Using your last known location**  
> Last confirmed today at 6:40 AM

> **Location unavailable**  
> Select a municipality to receive relevant local information.

The app must never silently use an old location while labeling information “near you.”

For the MVP:

- municipality selection is always supported;
- barangay selection may be supported where source data is reliable;
- device location is optional and requested in context;
- continuous background tracking is not used;
- the citizen can always view and change the active location;
- manual selection remains available after permission denial.

### 6.8 Official alert module

The alert module must show:

- impact-first headline;
- recommended action;
- affected area;
- issued and updated times;
- effective or expiry period;
- official issuing authority;
- technical classification in details;
- current, expired, stale, or unavailable state.

Expired alerts must not remain styled as active.

### 6.9 Active-report module

Home may show one report selected by this order:

1. Report requiring citizen action
2. Most recently changed active report
3. Most recent queued or failed submission
4. Most recent unresolved report

The module must show:

- incident type;
- plain-language status;
- whether action is required;
- exact last update;
- direct link to the Response Thread.

Home must never imply that a local draft or queued item has been received.

### 6.10 Nearby incident module

Home shows at most one nearby public incident.

It may show only:

- verified or explicitly approved public incidents;
- current and locally relevant incidents;
- generalized locations;
- approved citizen-safe statuses;
- distance bands rather than false precision.

Recommended distance labels:

- Within your barangay
- About 1 km away
- About 2–5 km away
- Elsewhere in your municipality

Example:

> **Verified flooding about 3 km away**  
> A response team has been assigned. Avoid the affected road when possible.

Home must not show:

- unverified reports as established incidents;
- exact residential addresses;
- reporter or responder identities;
- unrestricted incident pins;
- private photos;
- speculative arrival times;
- every minor report in chronological order.

### 6.11 Weather module

The weather module translates conditions into public-safety relevance. It is not intended to replace a dedicated weather application.

It should include:

- the most important expected impact;
- high and low temperatures;
- precipitation or wind only when useful;
- official source;
- forecast or bulletin time;
- severe-weather warning, when present;
- stale-data indicator.

Example:

> **Rain may affect the afternoon commute**  
> Moderate rain is possible after 2 PM. Avoid crossing flooded roads.  
> 29° / 25° · Updated today at 6:00 AM

When a severe official warning exists, it takes precedence over the routine forecast.

### 6.12 Emergency contacts

Emergency contacts must be:

- available without sign-in;
- reachable from Home and urgent alert states;
- clearly separated from app reporting;
- labeled by service and coverage;
- usable through accessible tap-to-call controls where supported.

The app must state that submitting a report does not replace emergency calling.

### 6.13 Home peak moment

The intended peak is:

> **The app understands the location I selected and has reduced several sources into one useful briefing.**

A restrained first-use sequence may:

1. confirm the location;
2. reveal the brief headline;
3. settle supporting information beneath it;
4. show the freshness timestamp.

Suggested copy:

> **Your local brief is ready**  
> Bantayog Alert will use Daet for local warnings, weather impacts, nearby verified incidents, and relevant report updates.

### 6.14 Home ending moment

Home must have a deliberate ending rather than infinite scroll.

Normal state:

> **You’re caught up through 7:12 AM**  
> New verified updates for your selected area will appear here.

Offline state:

> **You’ve reached the end of the saved brief**  
> Last synchronized today at 6:40 AM.

Feed remains the destination for browsing more public incidents.

### 6.15 Required Home states

Design and test at least:

1. First visit with no location
2. Device-location permission not requested
3. Device-location permission denied
4. Saved municipality available
5. Last-known location available
6. Normal day with no active official alert
7. Routine weather impact
8. Severe weather advisory
9. Emergency instruction
10. Nearby verified incident
11. No nearby incident
12. Active report with no action required
13. Report requiring citizen action
14. Queued report
15. Failed submission
16. Data failed to load
17. Cached data within freshness window
18. Cached data is stale
19. Device offline with saved data
20. Device offline without saved data
21. Citizen has no account
22. All information loaded successfully

---

## 7. Map, Feed, and Profile Surfaces

### 7.1 Map

Map is a spatial investigation tool, not the default Home.

It must:

- display only public-projection incidents;
- generalize sensitive locations;
- support list or text alternatives;
- show current filters and time range;
- distinguish verified incidents from official alerts;
- avoid responder tracking;
- avoid implying exact household locations;
- provide accessible incident summaries outside the map canvas.

### 7.2 Feed

Feed is the browsable public incident list.

It should:

- show verified or approved incidents only;
- support filters such as category, municipality, recency, and status;
- use finite pagination or deliberate loading;
- avoid popularity sorting;
- avoid comments, voting, and social reactions;
- link to public incident details;
- explain when no matching incidents exist.

### 7.3 Profile

Profile may include:

- citizen report history;
- active and closed reports;
- saved municipality or barangay;
- notification preferences;
- language;
- text and motion preferences;
- contact information;
- privacy explanations;
- local-draft management;
- sign-in and sign-out.

A citizen must not be required to create an account merely to view public safety information or emergency contacts.

---

## 8. Core Citizen Reporting Journey

### 8.1 Stage 1 — Enter the report flow

Citizen question:

> **Can this help me report what is happening?**

Primary action:

> **Report an incident**

Supporting routes:

- Continue saved report
- Track a report
- Emergency contacts

Required service statement:

> Bantayog Alert does not replace emergency hotlines, PAGASA, or national warning systems. If someone is in immediate danger, use the appropriate emergency channel.

### 8.2 Stage 2 — Select incident type

Primary prompt:

> **What is happening?**

Use understandable categories with short consequence-oriented descriptions.

Examples:

**Flooding**  
Water rising in a road, home, riverbank, or low-lying area.

**Fallen tree or obstruction**  
A tree, post, debris, or object blocking access.

**Fire or smoke**  
Visible fire, uncontrolled burning, or dangerous smoke.

Supporting guidance:

> Choose the closest match. An authorized officer can correct the category during review.

Requirements:

- visible text labels;
- no unexplained icon-only grid;
- keyboard and assistive-technology support;
- selection preserved in the local draft.

### 8.3 Stage 3 — Add location

Primary prompt:

> **Where is it happening?**

Supporting explanation:

> This helps the local office identify the responsible area and guide the response team.

Supported methods:

- current phone location;
- manual map pin;
- municipality and barangay selection;
- nearby landmark or address description.

Required feedback:

> **Location from your phone**  
> Estimated accuracy: 18 metres

or:

> **Manually selected location**  
> Barangay V, Daet

Missing-location message:

> **The location is still missing.**  
> The local office may not know where the incident occurred. Drop a pin, select the barangay, or describe a nearby landmark.

Requirements:

- expose low confidence;
- request permission in context;
- retain manual alternatives;
- never make the map the only method;
- preserve the selected location in the local draft.

### 8.4 Stage 4 — Describe the situation

Primary prompt:

> **What should the response team know?**

Supporting guidance:

> Describe what is happening now, who may be affected, and any immediate danger you can see.

Requirements:

- avoid bureaucratic labels such as “Incident narrative”;
- preserve text after validation errors and navigation;
- use guidance based on operational usefulness;
- do not require specialist severity terminology;
- provide a clear but non-punitive length limit.

### 8.5 Stage 5 — Add evidence

Photos or other evidence are optional unless an approved policy explicitly requires them for a category.

Show:

- selected file count;
- preview or filename;
- per-file upload state;
- size and format guidance;
- plain-language failure;
- remove and retry controls;
- whether the report can proceed without the failed file.

The written report and location must not be lost because an optional upload fails.

### 8.6 Stage 6 — Choose contact preference

Prompt:

> **Can the local office contact you about this report?**  
> Your contact information will not appear publicly.

The citizen must understand:

- whether contact is optional;
- why contact may help;
- which authorized users may access it;
- whether the report can proceed anonymously or pseudonymously;
- how contact details are protected.

### 8.7 Stage 7 — Review readiness

Use operational readiness rather than a productivity percentage.

Ready state:

> **Your report is ready to send**  
> The incident type, location, and essential details are available for local-office review.

Checklist:

- Incident type added
- Location confirmed
- Description added
- Photo optional
- Contact information optional

Missing-critical-information state:

> **One important detail remains: confirm where the incident is happening.**

### 8.8 Stage 8 — Review and send

Assemble a concise human-readable preview:

> **Please check these details before sending**
>
> Flooding  
> Barangay III, Daet  
> Near the public market  
> Happening now

Primary action:

> **Send report**

Secondary action:

> Edit details

Requirements:

- prevent duplicate taps;
- preserve fields after editing one section;
- avoid long legal confirmation screens;
- explain material privacy terms at the relevant field;
- generate an idempotency key before the first send attempt.

### 8.9 Stage 9 — Submit

Show truthful delivery progress:

1. Preparing report
2. Uploading evidence
3. Sending report
4. Waiting for confirmation

Do not show success before the backend returns a permanent reference.

Slow optional upload:

> **Uploading 2 photos**  
> The written report and mapped location are ready. Keep this page open while the evidence finishes uploading.

Where backend policy allows, the citizen may remove a failed optional attachment and continue.

### 8.10 Stage 10 — Confirmation

#### Outcome A — Server confirmed

> **Your report has been received**
>
> Tracking reference  
> **BA-26-0619-1842**
>
> The report is now waiting for review by the appropriate local office.  
> **This does not mean that a response team has already been assigned.**

Primary action:

> **Track this report**

Secondary actions:

- Copy reference
- Save reference
- Return home

The interface may use a short restrained transition from “Your phone” to “Bantayog Alert.” It must not use confetti.

#### Outcome B — Saved but not sent

> **Your report is saved but has not been sent**  
> Your connection appears unstable. The information remains on this phone, and the app will clearly confirm when Bantayog Alert receives it.

Primary action:

> **Try sending again**

Secondary actions:

- Continue editing
- Return later

This state must be visually and semantically distinct from receipt.

---

## 9. Report Tracking — The Response Thread

### 9.1 Purpose

The Response Thread is the primary report-tracking surface. A map is secondary.

It must answer:

1. What happened?
2. What does it mean?
3. What should the citizen do?
4. When was it last updated?

### 9.2 Default visible stages

The detailed state model may contain many states, but the default thread groups them into:

1. **Saved or sending**
2. **Received**
3. **Being reviewed**
4. **Response coordinated**
5. **Addressed or closed**

A details view may expose approved milestones such as verified, assigned, acknowledged, en route, and on scene.

### 9.3 Thread behavior

The Response Thread must:

- show only persisted states;
- preserve completed milestones;
- show exact timestamps;
- distinguish current, completed, pending, and exception states without relying on color;
- state whether citizen action is required;
- hide states that have not occurred;
- display delivery state before operational state exists;
- retain history for duplicate, referral, inability to verify, and closure;
- expose an ordered semantic structure to screen readers.

### 9.4 Tracking header

The top of the tracking screen must show:

1. restrained status symbol;
2. plain-language headline;
3. one-sentence explanation;
4. next valid action;
5. exact last-update time.

Example:

> **A response team has been assigned**  
> The local office sent your report and mapped location to a response team today at 3:42 PM. Keep away from the affected area while they respond.

Supporting details:

- tracking reference;
- incident type;
- reported location;
- time received;
- current public status;
- narrative activity history;
- citizen action requirement;
- official public contact channel.

### 9.5 No-update state

> **There is no new action yet**  
> Your report remains under review. You do not need to submit it again.

### 9.6 Extended-wait state

> **Your report is still awaiting review**  
> It was received yesterday at 4:12 PM. No new action has been recorded yet.

The app must not fabricate intermediate progress to make waiting feel shorter.

### 9.7 Needs-information state

> **More information is needed**  
> Add the requested location detail so the local office can continue reviewing your report.

Primary action:

> **Add requested detail**

The request must include:

- what information is missing;
- why it is needed;
- whether a deadline exists;
- whether the original report remains recorded;
- confirmation after the citizen responds.

### 9.8 Narrative activity history

Do not expose raw audit codes such as:

- `STATUS_CHANGED`
- `ADMIN_VERIFIED`
- `DISPATCH_CREATED`

Translate approved public events into clear entries.

Example:

#### Today

**3:42 PM — A response team was assigned**  
The local office forwarded the incident details and mapped location.

**3:18 PM — Your report was verified**  
An authorized officer confirmed that the report required response coordination.

**3:05 PM — Report received**  
Bantayog Alert securely received your report and created the tracking reference.

Requirements:

- chronological and persistent history;
- exact timestamp per entry;
- approved event templates;
- no private names, phone numbers, internal notes, or restricted dispatch details;
- auditable corrections;
- no silent rewriting of prior public events.

### 9.9 Report endings

Every ending must include:

- outcome;
- reason or recorded action;
- final timestamp;
- citizen action requirement;
- next valid route.

#### Resolved

> **This report has been resolved**  
> Responders completed the recorded action on June 19 at 6:35 PM.  
> **Outcome:** Fallen tree removed from the roadway.
>
> This report is now closed. Keep the reference if you need to contact the local office about this incident.

Actions:

- View report history
- Report a continuing or new incident
- Was this update clear? Yes / No

#### Unable to verify

> **The local office could not verify this report**  
> The available details were not enough to confirm the incident.  
> **Reason:** The location could not be identified.
>
> You may submit a new report with a map location or nearby landmark if the incident is still happening.

Actions:

- Correct and resubmit, when supported
- Review original report
- View official contact channel

#### Duplicate

> **This incident is already being handled**  
> Your report appears to describe an incident already recorded by the local office. You may follow the related public incident below. Your original submission remains recorded.

#### Referred

> **This incident requires a different contact channel**  
> Bantayog Alert does not replace official emergency hotlines. Use the contact below if immediate assistance is still required.

#### Closed without additional response

> **The local office has closed this report**  
> Review the recorded reason below. No further action is currently recorded.

### 9.10 Citizen closure confirmation

Where policy permits, ask:

> **Is the issue still present?**

Options:

- No, it appears addressed
- Yes, it still needs attention
- I am not sure

This response must not silently reopen or alter an official case unless backend rules explicitly permit that transition.

---

## 10. Advisory and Public-Safety Content

### 10.1 Impact-first structure

Advisories should lead with consequence and action.

Instead of:

> TCWS No. 2  
> 62–88 km/h  
> 24-hour lead time

Use:

> **Damaging winds may begin within about 24 hours.**  
> Light structures and unsecured roofing may be damaged. Secure loose outdoor items and continue monitoring official instructions.

Then show:

1. What this means
2. What action is recommended
3. Affected location
4. Effective period
5. Issue and update times
6. Official authority
7. Technical classification and measurements

### 10.2 Source integrity

The app must:

- preserve the official issuing authority;
- link to approved source details where available;
- avoid changing the meaning of official guidance;
- identify whether text is official, templated interpretation, or recorded staff update;
- expire or archive content according to source validity;
- retain technical details for citizens who need them.

### 10.3 Deterministic content templates

Public-safety copy must come from approved templates and structured fields.

A template should define:

- required facts;
- optional facts;
- prohibited claims;
- action language;
- location insertion rules;
- freshness language;
- escalation language;
- translation identifier;
- version and approver.

### 10.4 Content hierarchy

Use this order for alerts, briefs, incidents, and tracking statuses:

1. Human meaning or immediate consequence
2. Recommended action
3. Affected location or scope
4. Current state and effective period
5. Exact issue or update time
6. Official source or responsible office
7. Technical details

### 10.5 Time formatting

Use exact understandable timestamps.

Preferred:

> **Received today at 4:42 PM**

Avoid using only:

> **Updated 1h ago**

Relative time may appear secondarily.

### 10.6 Location formatting

Prefer human-readable location labels.

Example:

> **Reported near the pinned location in Barangay III, Daet**  
> Location source: Phone GPS  
> Estimated accuracy: 18 metres

Do not lead with raw coordinates unless a technical user explicitly requests them.

---

## 11. Voice and Content Design

### 11.1 Product personality

Citizen PWA should sound like:

> **A composed provincial coordinator who explains what is happening, protects privacy, acknowledges uncertainty, and never leaves the citizen wondering what comes next.**

The voice is:

- calm;
- plain;
- respectful;
- locally understandable;
- protective without being patronizing;
- precise about uncertainty;
- transparent about system limits;
- non-theatrical.

### 11.2 Prohibited patterns

Do not use:

- jokes or sarcasm in incident flows;
- exaggerated celebration;
- guilt-based reminders;
- bureaucratic codes as primary content;
- unsupported promises that help is coming;
- vague success messages such as “Done!”;
- accusatory terms such as “Invalid report”;
- praise that may encourage unnecessary reporting;
- alarmist copy unsupported by source data;
- “near you” without a visible location basis;
- “safe” as a conclusion from the absence of an alert.

### 11.3 Message contract

Every primary status message should answer:

1. **What happened?**
2. **What does it mean?**
3. **What should I do?**
4. **When was it updated?**
5. **Who or what is the source?**, when relevant.

---

## 12. Notifications and Permission Design

### 12.1 Permission timing

Do not request notification permission immediately after installation or onboarding.

Offer it after contextual value exists, such as:

- the citizen selects a saved location;
- a report is successfully received;
- a report reaches assignment;
- the citizen opens alert preferences.

Example:

> **Receive urgent updates for Daet**  
> Turn on notifications to receive evacuation and severe-weather warnings when the app is closed.

The native permission prompt appears only after the citizen intentionally chooses **Turn on notifications**.

### 12.2 Notification categories

Potential categories:

- urgent official alerts for selected location;
- severe-weather warnings;
- report action required;
- report status changed;
- report resolved or closed.

The citizen must be able to configure categories where platform support allows.

### 12.3 Notification content

Notifications must:

- state the recorded change;
- avoid sensitive lock-screen details where possible;
- avoid claiming unverified physical events;
- deep-link to the relevant view;
- avoid duplicate notifications for the same event;
- honor location and category preferences.

Example:

> **Update to report BA-26-0619-1842**  
> A response team has been assigned. Open Bantayog Alert for the latest recorded details.

---

## 13. Offline, Draft, and Submission Reliability

### 13.1 Draft preservation

Autosave locally after meaningful changes, including:

- category selection;
- location selection;
- description changes;
- evidence-selection metadata;
- contact preference;
- review-stage edits.

Display:

> **Your unfinished report is saved on this phone.**  
> You can continue when it is safe to do so.

### 13.2 Draft lifecycle

The implementation must document:

- local storage mechanism;
- protection appropriate to data sensitivity;
- draft expiry;
- behavior after browser-data clearing;
- behavior across app updates;
- whether drafts are device-bound;
- maximum number of drafts;
- duplicate prevention;
- explicit delete controls.

### 13.3 Queued submission

A queued submission must:

- remain visibly unconfirmed;
- preserve the intended payload;
- retry according to documented rules;
- avoid duplicate server records;
- use an idempotency key or equivalent;
- notify the citizen only after actual server confirmation;
- allow manual retry;
- explain what happens if the app closes.

### 13.4 Evidence upload

Where feasible, support:

- client-side image compression;
- per-file progress;
- individual retry;
- failed optional-file removal;
- duplicate-upload prevention;
- visible size and format limits;
- preservation of report text and location.

### 13.5 Source of truth

Client state, optimistic UI, a local queue, and background-sync registration are not proof of receipt.

Only a backend-created permanent reference may mark a report as received.

### 13.6 Home caching

The Home cache should store only the minimum citizen-safe information required for useful offline display.

It must record:

- source timestamps;
- last successful synchronization;
- active location used;
- expiry or stale thresholds;
- whether the information is current, cached, or stale.

Cached data must not silently appear current.

### 13.7 Recovery messages

Connectivity failure:

> **Your report has not been lost**  
> The connection was interrupted before delivery. Your details remain saved on this phone.

Stale Home data:

> **Showing the last available local brief**  
> Last updated yesterday at 8:00 PM. Connect to the internet for newer information.

No saved Home data:

> **Local information is not available offline yet**  
> Connect to the internet to load alerts, weather impacts, and nearby verified incidents.

---

## 14. Interaction and Visual Design Requirements

### 14.1 Visual hierarchy

- One dominant action per state.
- Urgent official instructions visually outrank report updates, incidents, and weather.
- Home modules must not all use identical visual weight.
- Status emphasis must correspond to real state importance.
- Routine decorative elements must recede during emergency states.

### 14.2 Motion

Motion may:

- confirm state change;
- explain transfer from device to server;
- connect Response Thread milestones;
- preserve spatial context;
- assemble the first local brief;
- acknowledge a completed action.

Motion must not:

- celebrate tragic events;
- imply unconfirmed progress;
- delay urgent actions;
- create long waiting ceremonies;
- use animated hazard backgrounds;
- override reduced-motion settings.

### 14.3 Status semantics

Every status must use at least two signals:

- text;
- icon;
- shape or border;
- thread position;
- semantic announcement.

Color alone is insufficient.

### 14.4 Layout stability

- Loading states preserve expected dimensions.
- Cards must not jump unpredictably after data loads.
- Primary actions remain reachable on small screens.
- Sticky actions must not cover content or assistive controls.
- Error messages should replace or annotate the affected module rather than collapse the whole page when partial data remains usable.

### 14.5 Touch and input

- Adequate touch targets.
- Visible labels rather than placeholder-only fields.
- Errors near relevant controls and announced accessibly.
- Logical focus after validation and dynamic updates.
- No destructive action without clear intent and recovery where feasible.

### 14.6 Loading strategy

Home should use stable module skeletons or reserved regions.

The product should:

- render the selected location early when locally available;
- prioritize urgent-alert retrieval;
- avoid blocking the whole Home screen because one source fails;
- show partial success transparently;
- retain the last valid module value while refreshing when policy permits.

---

## 15. Accessibility Requirements

The MVP must include:

- semantic headings and landmarks;
- visible keyboard focus;
- accessible names for controls;
- appropriate live regions for status updates;
- non-color status cues;
- sufficient contrast;
- scalable text without loss of function;
- reduced-motion support;
- alternative text for informative images;
- literal concise labels;
- plain-language validation;
- screen-reader-accessible Response Thread order;
- map alternatives for location selection and incident browsing;
- accessible touch targets;
- correct language metadata;
- accessible emergency contact controls.

Test at minimum:

- keyboard-only navigation;
- screen-reader Home, report submission, and tracking;
- 200% text scaling;
- reduced-motion mode;
- low-vision contrast;
- small-screen layout;
- offline and interrupted-network flows;
- location-permission denial;
- dynamic emergency-alert insertion;
- stale-data announcements.

---

## 16. Privacy, Safety, and Ethical Guardrails

Citizen PWA must not:

- reward or rank residents by report volume;
- use streaks, badges, points, or leaderboards;
- shame incomplete or abandoned reports;
- create unsupported urgency;
- imply government action before it is recorded;
- use cheerful animation to obscure delays;
- pressure contact-information disclosure;
- publicly expose sensitive locations;
- reveal responder names or private phone numbers;
- expose internal notes or unrestricted dispatch data;
- use comments or voting to determine legitimacy;
- generate emotional or safety-critical copy without approved rules;
- imply that app reporting replaces emergency calling;
- track precise location continuously in the background;
- disclose one citizen's private report through another citizen's Home brief.

### 16.1 Safe citizen projection

Citizen-facing APIs must explicitly allowlist fields rather than return internal records and remove a few known-sensitive fields.

Citizen-safe data may include:

- public tracking reference;
- citizen-submitted incident summary for the reporting citizen;
- generalized public incident summary;
- approved location display;
- public status;
- approved explanation;
- public timeline events;
- exact public timestamps;
- citizen action requirements;
- official public contact channel;
- approved public outcome.

### 16.2 Contextual privacy explanations

Explain privacy where data is requested:

- location;
- photos;
- phone or email;
- local draft storage;
- notification permission;
- public incident projection;
- optional analytics.

### 16.3 Public location protection

Public incident location must be generalized according to approved rules, such as:

- road segment;
- landmark area;
- barangay;
- distance band;
- municipality.

The citizen's own tracking view may show more precise submitted location according to authorization and policy.

### 16.4 Emergency limitation

At appropriate moments, state:

> Bantayog Alert does not replace emergency hotlines. If someone is in immediate danger, contact the appropriate emergency service.

This warning must be visible but must not dominate every routine interaction.

---

## 17. Data and Interface Contracts

### 17.1 Local brief response

A Home brief response should provide structured data rather than a single opaque paragraph.

Recommended fields:

```ts
type LocalBrief = {
  location: {
    id: string
    label: string
    level: 'municipality' | 'barangay' | 'approximate_device_area'
    source: 'saved' | 'manual' | 'device' | 'last_known'
    confirmedAt?: string
  }
  generatedAt: string
  freshness: 'current' | 'cached_current' | 'stale' | 'unavailable'
  priority: 'emergency' | 'action_required' | 'warning' | 'normal'
  headline: string
  summary: string
  primaryAction?: Action
  sources: SourceReference[]
  alert?: AlertSummary
  report?: CitizenReportSummary
  nearbyIncident?: PublicIncidentSummary
  weather?: WeatherImpactSummary
}
```

The server or approved rule engine should return the template identifier and facts used to assemble the brief.

### 17.2 Report status response

Recommended citizen-safe shape:

```ts
type CitizenReportStatus = {
  reference: string
  deliveryState: DeliveryState
  operationalState?: OperationalState
  headline: string
  explanation: string
  citizenAction: {
    required: boolean
    label?: string
    route?: string
    dueAt?: string
  }
  locationDisplay: string
  receivedAt?: string
  updatedAt: string
  publicTimeline: PublicTimelineEvent[]
  outcome?: {
    label: string
    explanation: string
    closedAt?: string
  }
}
```

### 17.3 Public incident response

Recommended citizen-safe shape:

```ts
type PublicIncidentSummary = {
  id: string
  category: string
  headline: string
  generalizedLocation: string
  distanceBand?: string
  publicStatus: string
  actionGuidance?: string
  occurredAt?: string
  updatedAt: string
  expiresAt?: string
  sourceLabel: string
  publicImageUrl?: string
}
```

### 17.4 Error contract

Errors should distinguish:

- source unavailable;
- unauthorized;
- validation failure;
- rate limit;
- unsupported file;
- upload interruption;
- duplicate submission;
- stale client;
- report not found;
- location unavailable.

Each error should provide:

- stable machine code;
- approved citizen-facing message key;
- retryability;
- field association where relevant;
- safe diagnostic correlation identifier.

Internal stack traces or sensitive details must never be exposed.

---

## 18. MVP Scope and Priorities

### 18.1 P0 — Required for the thin end-to-end MVP

#### Home and local awareness

- Home as the default tab
- Visible selected location and change control
- Municipality-level manual location
- Optional contextual device-location use
- Deterministic Your Local Brief
- Official alert summary
- Impact-first weather summary
- One nearby verified incident summary
- Most relevant active-report summary
- Emergency-contact access
- Exact freshness timestamps
- Current, empty, unavailable, offline, and stale states
- Finite Home ending
- Routes to alert, forecast, incident, and report details

#### Reporting and tracking

- Visible Response experience model
- Response Thread
- Separate delivery and operational state layers
- Local draft preservation
- Honest queued, sending, confirmed, and failed states
- Report-readiness guidance
- Human-readable review
- Backend-confirmed receipt
- Permanent tracking reference
- Narrative public activity history
- Exact timestamps
- Location-source and accuracy explanation
- Recovery-oriented upload and network errors
- Needs-information flow
- Unable-to-verify, duplicate, referral, resolved, and closed endings
- Safe citizen data projection

#### Cross-cutting

- Emergency limitation
- Contextual privacy explanations
- Accessible non-color status indicators
- Reduced-motion support
- Map alternative for location entry
- Stable layouts and partial-source failure
- Approved deterministic microcopy templates
- Basic analytics without sensitive content

### 18.2 P1 — Add after the core loop is proven

- Barangay-level personalization where data quality permits
- Multiple saved locations
- Contextual notification preferences
- Scheduled morning brief notification
- Filipino language switching
- Individual evidence-upload retry
- Improved location-confidence coaching
- Road-closure and evacuation-center summaries
- Citizen closure confirmation
- Two-tap clarity feedback
- More advanced proximity filtering
- User-configurable alert categories
- Carefully validated local-language content
- Subtle brief and status transitions

### 18.3 Deferred

- AI-generated daily briefs
- Continuous background location
- Personalized risk scores
- Municipal or personal safety scores
- Community posts, comments, or chat
- Incident voting
- Social sharing
- Citizen contribution badges
- Reporting streaks
- Civic points
- Public leaderboards
- Mascot-driven emergency experiences
- Elaborate 3D or animated weather environments
- Speculative response-time estimates
- Live responder locations
- Community reputation systems
- Broad behavioral personalization

---

## 19. Analytics and Evaluation

Evaluation must focus on comprehension, reliability, trust, usefulness, and recovery—not only visual appeal.

### 19.1 Required usability scenarios

1. Open Home with a saved municipality and explain the local brief.
2. Identify which location Home is using.
3. Distinguish “no active alert” from “alerts unavailable.”
4. Interpret a stale weather forecast.
5. Find a nearby verified incident.
6. Respond to an emergency instruction.
7. Complete and submit a report with stable connectivity.
8. Begin a report, lose connectivity, and recover it.
9. Distinguish saved, queued, sending, failed, and received states.
10. Find the current operational status.
11. Explain what “under review” means.
12. Determine whether another report is required.
13. Respond to a request for information.
14. Understand unable-to-verify, duplicate, and referral outcomes.
15. Interpret final resolution.
16. Find emergency contacts.
17. Complete key journeys with keyboard and screen reader.

### 19.2 Core measures

Measure:

- local-brief comprehension accuracy;
- selected-location identification accuracy;
- urgent-instruction discovery time;
- stale-versus-current comprehension;
- report-completion success;
- median time to review-ready report;
- backend-confirmation success;
- duplicate-submission rate;
- delivery-state comprehension;
- operational-status comprehension;
- next-action accuracy;
- draft-recovery success;
- failed-upload recovery;
- critical error rate;
- perceived trust;
- perceived clarity;
- perceived local relevance;
- accessibility task success.

### 19.3 Suggested questionnaire statements

Participants may rate:

- I understood what information was most important on Home.
- I could tell which location the app was using.
- I could tell whether the information was current or saved.
- I understood the difference between no active alert and unavailable data.
- I could tell whether my report was saved, sending, or received.
- I understood what would happen after submission.
- The statuses used language I could understand.
- I knew whether I needed to act.
- The tracking page reduced my uncertainty.
- The final status clearly explained what happened.
- The app did not promise action that had not been confirmed.
- I could recover my report after losing internet access.
- I understood why location or contact information was requested.
- I could distinguish app reporting from emergency calling.

### 19.4 Event instrumentation

Instrument at minimum:

#### Home

- home_opened;
- location_source_displayed;
- location_changed;
- local_brief_loaded;
- local_brief_failed;
- stale_brief_displayed;
- urgent_alert_viewed;
- nearby_incident_viewed;
- forecast_viewed;
- emergency_contacts_opened;
- report_summary_opened.

#### Reporting

- report_flow_started;
- draft_autosaved;
- draft_restored;
- location_method_selected;
- readiness_reached;
- submission_initiated;
- submission_queued;
- submission_retry_attempted;
- server_confirmation_received;
- duplicate_submission_prevented;
- tracking_opened;
- needs_information_opened;
- needs_information_submitted;
- resolution_viewed;
- clarity_feedback_submitted.

Analytics must not capture sensitive report content unless explicitly approved, necessary, minimized, and protected.

---

## 20. Acceptance Criteria

The MVP is not complete until all criteria below are satisfied.

### 20.1 Home truthfulness

- Home always identifies the selected or derived location.
- “Near you” is not used without a visible location basis.
- `empty_confirmed` is visibly distinct from unavailable, offline, and stale states.
- Urgent official instructions outrank routine modules.
- Home never states or implies that an area is completely safe.
- Home shows no unapproved public report.
- Home displays exact update or source timestamps.
- Home has a finite ending and no infinite scroll.

### 20.2 Submission truthfulness

- A local or queued report is never styled or announced as received.
- Success appears only after a permanent backend reference is returned.
- Normal retry scenarios do not create duplicate reports.
- A delivery error preserves valid citizen work.

### 20.3 Citizen comprehension

- A test participant can identify the Home location without assistance.
- A test participant can distinguish no active alerts from a failed alert update.
- A test participant can distinguish saved, queued, sending, failed, and received report states.
- A test participant can explain the current report state and next action.
- Operational codes are never the only visible explanation.

### 20.4 Recovery

- A draft survives an ordinary reload and restart according to retention policy.
- Validation does not erase valid fields.
- Optional upload interruption does not erase report text or location.
- Failed delivery provides a working retry path.
- Cached Home data exposes its age and source state.

### 20.5 Closure

- Resolved, closed, unable-to-verify, duplicate, and referred outcomes use approved content.
- Every final state includes a timestamp, reason or recorded action, and next valid route.
- Closed reports remain available in report history according to retention policy.

### 20.6 Accessibility

- Home, report, and tracking flows can be completed with keyboard navigation.
- The Response Thread is understandable without color.
- Dynamic urgent states and submission changes are announced appropriately.
- Reduced-motion preference is respected.
- A non-map location alternative exists.
- Text scaling to 200% does not remove essential functionality.

### 20.7 Safety and privacy

- Emergency limitations appear at relevant moments.
- Contact information is optional unless approved policy requires it.
- Citizen-facing APIs expose only allowlisted fields.
- No private responder, reporter, or internal dispatch information appears in public views.
- Public incident locations follow approved generalization rules.
- Permission requests are preceded by a contextual explanation.

### 20.8 Performance and resilience

Target values should be finalized during technical planning, but at minimum:

- Home renders a meaningful shell and saved location before all remote modules finish.
- One failing data source does not blank the entire Home experience.
- The report form remains usable on constrained mobile connections.
- Primary actions do not require large decorative assets.
- Service-worker or cache failure does not create false receipt or false freshness.

---

## 21. Reference Microcopy Library

### 21.1 Home — no active alert

> **No active official alerts were found for Daet**  
> Rain may affect travel later this afternoon.

### 21.2 Home — unavailable alerts

> **Alerts could not be updated**  
> Showing information last checked today at 6:40 AM.

### 21.3 Home — no location

> **Choose your area for local information**  
> Select a municipality to see relevant alerts, weather impacts, and verified incidents.

### 21.4 Home — stale brief

> **Showing the last available local brief**  
> Last updated yesterday at 8:00 PM. Connect to the internet for newer information.

### 21.5 Home — caught up

> **You’re caught up through 7:12 AM**  
> New verified updates for your selected area will appear here.

### 21.6 Draft

> **Your unfinished report is saved on this phone.**  
> You can continue when it is safe to do so.

### 21.7 Queued

> **Waiting for an internet connection**  
> Your report is ready but has not reached Bantayog Alert.

### 21.8 Sending

> **Sending your report securely**  
> Keep this page open until receipt is confirmed.

### 21.9 Confirmed

> **Your report has been received**  
> It is now waiting for review by the appropriate local office.

### 21.10 Under review

> **The local office is reviewing the details**  
> You do not need to submit the same report again.

### 21.11 More information needed

> **More information is needed**  
> Add the requested detail so the local office can continue reviewing the report.

### 21.12 Assigned

> **A response team has been assigned**  
> The local office sent the recorded incident details and mapped location to a response team.

### 21.13 En route

> **The response team reported that they are on the way**  
> Stay away from danger and keep your phone available when possible.

### 21.14 On scene

> **The response team reported arriving at the location**  
> The team is assessing or handling the incident.

### 21.15 Resolved

> **The recorded response action has been completed**  
> Review the outcome below. Report again only if a new or continuing danger remains.

### 21.16 Unable to verify

> **The local office could not verify this report**  
> Review the reason below and provide the missing detail if the incident is still happening.

### 21.17 Submission failure

> **Your report has not been lost**  
> The connection was interrupted before delivery. Your information remains saved on this phone.

### 21.18 Notification explanation

> **Receive urgent updates for Daet**  
> Turn on notifications to receive evacuation and severe-weather warnings when the app is closed.

### 21.19 Location explanation

> **Use your location for relevant updates**  
> Bantayog Alert uses your approximate area to show local alerts and nearby verified incidents. You can also select a municipality manually.

---

## 22. QA State Matrix

| Area          | State                  | Required assertion                                                              |
| ------------- | ---------------------- | ------------------------------------------------------------------------------- |
| Home          | No location            | Municipality selection is the dominant action.                                  |
| Home          | No active alert        | Copy states that no active alert was found; it does not claim complete safety.  |
| Home          | Alert source failure   | Failure is not displayed as “no alerts.”                                        |
| Home          | Stale cache            | Last successful update is visible.                                              |
| Home          | Emergency alert        | Emergency instruction outranks greeting and weather.                            |
| Home          | Report needs action    | Direct action opens the relevant requested field.                               |
| Home          | Nearby incident        | Incident is verified and location is generalized.                               |
| Home          | Partial source failure | Usable modules remain visible with source-specific error.                       |
| Report        | Draft                  | Draft is clearly device-local.                                                  |
| Report        | Offline queue          | Queue is not presented as received.                                             |
| Report        | Retry                  | Idempotency prevents duplicate server records.                                  |
| Report        | Upload failure         | Text and location remain intact.                                                |
| Tracking      | Under review           | No assignment is implied.                                                       |
| Tracking      | Assigned               | Assignment time and source are shown.                                           |
| Tracking      | En route               | Wording attributes the update to the response team.                             |
| Tracking      | No update              | No fabricated progress appears.                                                 |
| Closure       | Duplicate              | Original submission remains recorded and related public incident may be linked. |
| Closure       | Unable to verify       | Reason and corrective route are shown.                                          |
| Accessibility | Reduced motion         | Meaning remains complete without transition effects.                            |
| Accessibility | Screen reader          | Urgent alert and status changes are announced in logical order.                 |
| Privacy       | Public incident        | No private contact, precise home address, or internal note is exposed.          |

---

## 23. External Design References

These references support impact-first warnings, accessible public-service interfaces, semantically distinct alert states, and cautious use of peak-end design:

1. PAGASA — Tropical Cyclone Wind Signal: <https://pagasa.dost.gov.ph/learning-tools/tropical-cyclone-wind-signal>
2. FEMA — Mobile Products and accessibility guidance: <https://www.fema.gov/about/news-multimedia/mobile-products>
3. U.S. Web Design System — Alert component: <https://designsystem.digital.gov/components/alert/>
4. W3C Web Accessibility Initiative: <https://www.w3.org/WAI/>
5. From Experience to Memory: On the Robustness of the Peak-and-End Rule for Complex, Heterogeneous Experiences: <https://pmc.ncbi.nlm.nih.gov/articles/PMC6668632/>

---

## 24. Final Product Direction

Citizen PWA should transform from:

> **A collection of government screens, alert cards, and report statuses**

into:

> **A calm local briefing and an accountable thread from citizen concern to recorded response.**

Its Home experience answers:

> **What matters around me right now?**

Its reporting experience answers:

> **Did the system receive what I sent?**

Its Response Thread answers:

> **What has the local government actually recorded, and what happens next?**

Its memorable Home moment is the reduction of several trusted sources into one useful local brief. Its memorable reporting moment is the truthful handoff from the citizen's device to the response system. Its memorable ending is a clear recorded outcome.

The product's long-term design advantage will not come from gamification, animation, or feature volume. It will come from disciplined choices that make citizens feel informed, protected, and confident that their concern did not disappear into a government system.
