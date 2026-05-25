# Research: What Makes a Great Dashboard Layout

**Date:** 2026-05-25
**Sources:** UXPin Studio (dashboard design principles), Endsley's Situational Awareness theory (Wikipedia / HCI literature), Nielsen Norman Group heuristics (established knowledge), DHS Situational Awareness Design Guidelines (established research)
**Context:** Research for `@bantayog/admin-desktop` — PDRRMO Camarines Norte Command Center

---

## 1. First: What Type of Dashboard Are You Building?

Not all dashboards are the same. The design patterns that work for an executive KPI dashboard will fail for an emergency operations center. According to UXPin's classification:

| Type | Purpose | Update Frequency | User | Example |
|------|---------|------------------|------|---------|
| **Analytical** | Identify trends, patterns, insights | Historical / periodic | Data analysts, BI teams | Sales performance over quarters |
| **Operational** | Real-time monitoring, quick decisions | Real-time / near real-time | Managers, operators, dispatchers | **Command center, EOC, NOC** |
| **Strategic** | High-level org performance | Long-term (monthly/quarterly) | Executives, C-suite | Quarterly revenue, market share |
| **Tactical** | Bridge operational and strategic | Short-term (weekly/daily) | Mid-level managers | Campaign performance, project status |

### Bantayog Alert admin-desktop is an **Operational Dashboard**

This is the most demanding type. Operational dashboards are used for **real-time monitoring and quick decision-making**. They display frequently updated data and are ideal for managers who need to track day-to-day operations and respond promptly to emerging issues.

**Implication:** The design must optimize for **speed of comprehension** and **rapid action**, not deep analysis. Every millisecond of cognitive load matters during an active incident.

---

## 2. The Theoretical Foundation: Endsley's Situational Awareness (SA)

Dr. Mica Endsley's model is the most widely cited framework for designing displays in high-stakes environments (aviation, air traffic control, emergency response, nuclear power, military command and control). It defines three ascending levels:

### Level 1: Perception
> *"The perception of the elements in the environment considering time and space."*

The user must first **see** the relevant data. In dashboard terms:
- Can the operator see that an incident has been reported?
- Can they see which municipality is affected?
- Can they see the severity and type?
- Can they see which responders are available?

**Design implication:** Critical data must be **visible at a glance** without scrolling, clicking, or searching. This is the "at-a-glance" principle.

### Level 2: Comprehension
> *"The understanding of their meaning — how it will impact upon the individual's goals and objectives."*

The user must **understand what the data means**. In dashboard terms:
- Is this a routine report or an escalating emergency?
- Is the responder capacity sufficient for the incident load?
- Is the FCM success rate degradation a temporary blip or a systemic failure?

**Design implication:** Raw data is insufficient. The dashboard must provide **context**: trends, comparisons to normal baselines, thresholds, and severity indicators. Use visual cues (color, size, position) to signal importance.

### Level 3: Projection
> *"The prediction of their status in the near future."*

The user must **anticipate what will happen next**. In dashboard terms:
- Will this flood report require evacuation if verified?
- If we dispatch Responder A to Incident X, who covers Area Y?
- If FCM delivery fails again, will the next escalation be missed?

**Design implication:** The dashboard should support **what-if thinking**. Show capacity limits, resource allocation, and time-sensitive deadlines. The "stalled dispatches" and "escalation count" in Bantayog are excellent examples of projection-supporting data.

### Team Situational Awareness
In team settings (like a PDRRMO command center with multiple operators), Endsley defines:

- **Team SA:** Every team member has the SA required for their responsibilities
- **Shared SA:** Team members have a common understanding of shared information requirements

**Design implication:** If multiple operators are viewing different screens (dashboard vs. map vs. feed), they must still share a common operating picture. Bantayog's cross-window sync (`WindowSyncProvider`) is a direct implementation of this principle.

---

## 3. Essential Dashboard Design Principles

### Principle 1: Establish a Clear Visual Hierarchy

Users' eyes naturally go to the top-left first, then sweep right and down (F-pattern and Z-pattern reading). The layout should exploit this.

**Best practices:**
- Place **most critical data at the top or left**
- Use **size** to signal importance — larger elements are more important
- Use **color** to differentiate categories and highlight anomalies
- Use **whitespace** to separate sections and reduce crowding
- Group **related data points together** to create coherent narratives

**For Bantayog:** The current `DashboardPage.tsx` layout has:
```
[CommandHeader]
[StatusBar] ← Good: top position
[DispatchStatsCards] ← Good: KPIs at top
[EscalationQueueSection] ← Excellent: urgent items high and visible
[DispatchVolumeChart | ResponderAvailabilityPanel]
[RecentEventsFeed | MunicipalPerformanceTable]
```
This follows the hierarchy well. The escalation queue is correctly placed high because it represents the most urgent action items.

**Anti-pattern to avoid:** Equal visual weight for all elements. If everything is bold, nothing is bold.

---

### Principle 2: Minimize Cognitive Load

Cognitive load theory (Sweller, 1988) tells us that working memory is limited. Dashboards must reduce unnecessary mental effort.

**Best practices:**
- **Remove non-essential elements** — every pixel should earn its place
- **Focus on actionable insights** — highlight what needs attention, not just what exists
- **Progressive disclosure** — show summaries first, details on demand (drill-downs, tooltips, expandable panels)
- **Limit the number of visualizations** — 3-5 well-chosen charts beat 12 mediocre ones
- **Use consistent chart types** — don't mix bar charts, radar charts, Sankey diagrams, and heatmaps just because you can

**The "5-second rule":** A user should be able to answer "What's the situation?" within 5 seconds of looking at the dashboard.

**For Bantayog:** The `AllClearState` is a perfect example of cognitive load reduction — when nothing is happening, it explicitly says so rather than showing empty tables that might worry the operator.

---

### Principle 3: Make Data Accessible and Actionable

A dashboard is not a report. Reports are for reading; dashboards are for **acting**.

**Best practices:**
- Every metric should answer: *"So what? What do I do about this?"*
- Provide **direct actions** from data — e.g., "Re-dispatch" button next to a stalled dispatch
- Use **appropriate visualizations**:
  - **Bar charts** for comparisons (incidents by municipality)
  - **Line charts** for trends over time (dispatch volume over 24h)
  - **Tables** for precise lookup (responder roster, triage queue)
  - **Maps** for spatial context (incident locations)
  - **Cards/KPIs** for single-number summaries (active incidents count)
- Avoid 3D charts, pie charts with many slices, and overly decorative visuals

**For Bantayog:** The `EscalationQueueSection` with inline "Re-dispatch" buttons is textbook actionable design. The `TriagePanel` with verify/reject/dispatch buttons directly on the report detail is also excellent.

---

### Principle 4: Maintain Consistency

Consistency reduces learning time and errors. In high-stakes environments, inconsistent design can cause hesitation or mistakes.

**Best practices:**
- **Consistent visual elements** — same color scheme, font styles, chart types across all views
- **Uniform interaction patterns** — filtering, drilling down, selecting all work the same way everywhere
- **Predictable color semantics** — red always means danger/urgent, green always means good/resolved, amber always means warning
- **Consistent layout structure** — header, status bar, main content, side panels in the same positions across Dashboard, Map, Feed, and Dispatches

**For Bantayog:** The `CommandHeader` with `windowRole` colored accents (dashboard=red, map=blue, feed=green, dispatches=amber) is a strong consistency pattern. Every page has the same header structure.

---

### Principle 5: Design for Accessibility

Accessible dashboards are not just ethically correct — they are **more usable for everyone**.

**Best practices:**
- **Don't use color alone** to convey information — always pair with icons, labels, or patterns
- **Ensure adequate contrast** — WCAG 2.1 AA requires 4.5:1 for normal text, 3:1 for large text
- **Provide keyboard navigation** — all interactive elements must be reachable without a mouse
- **Use ARIA labels** — screen readers must be able to interpret charts and data tables
- **Respect `prefers-reduced-motion`** — animations can be distracting or disabling for some users
- **Test with color blindness simulators** — deuteranopia (red-green) is the most common form

**For Bantayog:** The `SeverityBadge` and `StatusBar` both use icons + color, which is correct. The `focus-visible:ring-2` pattern on interactive elements is good for keyboard navigation.

---

## 4. Emergency Operations Center (EOC) Specific Design Patterns

Beyond general dashboard principles, EOC/command center displays have unique requirements derived from Endsley's SA research and DHS design guidelines.

### The OODA Loop
Col. John Boyd's OODA loop (Observe → Orient → Decide → Act) is the decision cycle in time-competitive environments. A great EOC dashboard accelerates this loop:

| OODA Phase | Dashboard Support | Bantayog Implementation |
|------------|-------------------|-------------------------|
| **Observe** | Alerts, notifications, real-time data | Firestore listeners, audio alerts, `OfflineBanner` |
| **Orient** | Context, maps, historical comparison | `ProvincialMap`, `DispatchVolumeChart`, `MunicipalPerformanceTable` |
| **Decide** | Recommended actions, resource status | `EscalationQueueSection`, `ResponderAvailabilityPanel`, `ReDispatchModal` |
| **Act** | One-click actions, confirmation dialogs | Verify/Reject/Dispatch buttons, `DeclareAlertModal`, `ConfirmationModal` |

### Critical EOC Patterns

#### 1. The Common Operating Picture (COP)
All team members must share the same understanding of the situation. This requires:
- **Shared displays** that show the same data to all operators
- **Synchronized views** across multiple screens (Bantayog's `WindowSyncProvider` does this)
- **Clear status indicators** so everyone knows what's current vs. stale

#### 2. Alert Fatigue Management
EOC operators receive hundreds of alerts. The dashboard must prevent fatigue:
- **Prioritize alerts** by severity, not just chronology
- **Batch related alerts** (Bantayog's anomaly detection)
- **Allow dismissal** with clear audit trail (`AnomalyAlertBanner` with dismiss)
- **Suppress non-actionable alerts** during high-load periods

#### 3. Resource Tracking
Knowing what resources are available is critical for dispatch decisions:
- **Real-time responder status** (online/away/offline + availability)
- **Capacity indicators** (how many responders per agency/municipality)
- **Assignment tracking** (who is assigned to what)

#### 4. Temporal Awareness
Incidents unfold over time. Operators need to understand:
- **When did this start?** (`submittedAt`, `createdAt`)
- **How long has it been?** (`formatRelativeTime` for last seen, last activity)
- **What's the deadline?** (escalation timeouts, response time targets)

#### 5. Geographic Awareness
Disasters are inherently spatial:
- **Map integration** is non-negotiable for EOC dashboards
- **Clustering** for high-density areas
- **Municipality-level drill-down** for jurisdiction tracking

---

## 5. Layout Architecture Patterns

### Pattern A: The "Z-Layout" (News/Content Sites)
```
[Header]        [User Actions]
   ↘
     [Main Content Area]
         ↘
[Secondary]     [Tertiary]
```
Best for: Reading-heavy dashboards where users scan headlines.

### Pattern B: The "F-Layout" (Scanning/Tables)
```
[Header — full width]
[KPI Row — full width]
[Left Sidebar] [Main Content — wider]
```
Best for: Operational dashboards with tables and lists. Bantayog's `TriagePanel` (sidebar) + `ProvincialMap` (main) follows this.

### Pattern C: The "T-Layout" (Command Centers)
```
[Header — full width]
[Status Bar — full width]
[Left Nav] [Main Content — grid of cards/widgets] [Right Sidebar]
```
Best for: EOC dashboards with many data sources. The main area uses a **card-based grid**.

### Pattern D: The "Dashboard Grid" (Most Common)
```
[Header]
[Row 1: KPI Cards (equal width)]
[Row 2: Chart (2/3) | Summary List (1/3)]
[Row 3: Table (full width)]
```
Best for: Flexible, modular dashboards where widgets can be rearranged.

**Bantayog's current layout is closest to Pattern C with some Pattern D elements:**
```
[CommandHeader]
[OfflineBanner] (conditional)
[DispatchStatsCards] — KPI row
[EscalationQueueSection] — urgent alerts row
[DispatchVolumeChart | ResponderAvailabilityPanel] — 2-column
[RecentEventsFeed | MunicipalPerformanceTable] — 2-column
```

This is a **strong layout** for an operational dashboard. The escalation queue being full-width above the 2-column grid correctly signals its importance.

---

## 6. The "Inverted Pyramid" for Information Density

Inspired by journalism's inverted pyramid, dashboard information should be structured from most to least critical:

```
┌─────────────────────────────────────┐
│  TIER 1: CRITICAL / ACTIONABLE      │
│  - Active incidents requiring       │
│    immediate response               │
│  - System failures / offline status   │
│  - Escalated dispatches             │
├─────────────────────────────────────┤
│  TIER 2: STATUS / MONITORING        │
│  - KPIs (active count, response     │
│    time, success rates)             │
│  - Current resource availability    │
│  - Recent activity feed             │
├─────────────────────────────────────┤
│  TIER 3: CONTEXT / ANALYSIS         │
│  - Trends and historical patterns   │
│  - Performance breakdowns           │
│  - Municipal comparisons            │
├─────────────────────────────────────┤
│  TIER 4: REFERENCE / DETAIL         │
│  - Full responder roster            │
│  - Complete incident history        │
│  - Settings, help, documentation    │
└─────────────────────────────────────┘
```

**Bantayog's current ordering:**
- Tier 1: `EscalationQueueSection` (stalled dispatches = actionable) ✓
- Tier 2: `DispatchStatsCards`, `RecentEventsFeed` ✓
- Tier 3: `DispatchVolumeChart`, `MunicipalPerformanceTable` ✓
- Tier 4: Responder details, help modal ✓

The ordering is correct. One suggestion: the `OfflineBanner` (network error) should arguably be Tier 1 — it currently renders below the header but above the main content, which is acceptable but could be more prominent.

---

## 7. Common Dashboard Layout Mistakes

### Mistake 1: The "Data Dump"
Showing every metric because it exists. If a number doesn't inform a decision, remove it.

**Symptom:** 12 KPI cards, 8 charts, 3 tables, all on one screen.
**Fix:** Use progressive disclosure. Show 4-6 KPIs, 2-3 primary charts, and put details in drill-downs.

### Mistake 2: The "Wall of Text"
Dashboards are visual. Text should be minimal and scannable.

**Symptom:** Paragraph descriptions where a badge or icon would suffice.
**Fix:** Replace "Status: This report is currently awaiting verification by a municipal administrator" with `StatusBadge: "awaiting_verify"`.

### Mistake 3: Misaligned Visual Hierarchy
Equal visual weight for everything means nothing stands out.

**Symptom:** All cards have the same size, border, and color. All text is the same weight.
**Fix:** Make actionable/urgent items larger, bolder, or more saturated. Use color sparingly — when everything is highlighted, nothing is.

### Mistake 4: Inappropriate Chart Types
- **Pie charts** for more than 3-4 categories (humans can't judge angles well)
- **3D charts** (distort perception, add no information)
- **Line charts** for categorical data (implies continuity where none exists)
- **Radar/spider charts** for most purposes (overly complex)

### Mistake 5: Missing "So What?"
Data without context is noise.

**Symptom:** "Active Incidents: 47" — is that good or bad? Normal or surge?
**Fix:** Add comparison: "47 (↑ 12% vs. 1h ago)" or color-code based on threshold.

---

## 8. Research-Backed Metrics for Dashboard Success

According to Dresner Advisory Services research cited by UXPin:
- Organizations with effective BI dashboards are **2x more likely** to experience improved decision-making
- Effective dashboard use correlates with **24% increase in revenue growth**

### Objective Measures of Dashboard Quality
From Endsley's SAGAT (Situation Awareness Global Assessment Technique) and HCI literature:

| Measure | How to Test | Target |
|---------|-------------|--------|
| **Time to answer** | "How many stalled dispatches?" | < 3 seconds |
| **Accuracy** | "Which municipality has the most incidents?" | 100% correct |
| **Error rate** | Wrong actions taken due to misread data | < 1% |
| **Mental workload** | NASA-TLX subjective rating | Moderate, not high |
| **Situational awareness** | SAGAT probe questions | High scores on all 3 levels |

### The "3-30-300" Rule for EOC Dashboards
A heuristic from emergency management practitioners:
- **3 seconds** to perceive an alert
- **30 seconds** to comprehend the situation
- **300 seconds** (5 minutes) to decide and act

Your dashboard layout should optimize for the first two.

---

## 9. Specific Recommendations for Bantayog Alert admin-desktop

Based on this research, the current layout is **strong** but can be improved:

### Already Excellent
1. ✅ **Escalation queue at top** — Correctly prioritizes actionable items
2. ✅ **KPI cards with trends** — `DispatchStatsCards` with trend arrows supports comprehension
3. ✅ **Cross-window sync** — Implements team/shared SA
4. ✅ **Color-coded window roles** — Consistent visual language
5. ✅ **One-click actions** — Verify, reject, dispatch, re-dispatch are immediate
6. ✅ **Empty states** — Reduces cognitive load during calm periods

### Recommended Improvements
1. **Add a persistent "Situation Summary"** — A single sentence at the top that always answers "What's happening?" Example: *"3 stalled dispatches, 12 active incidents, FCM delivery degraded."* This supports Level 2 SA (comprehension).

2. **Elevate the `OfflineBanner`** — Network failures should arguably be a modal or persistent banner that doesn't scroll away. During an incident, losing sync is a critical failure.

3. **Add trend context to KPIs** — "47 Active Incidents" is better as "47 Active (↑12% in 1h, ↑40% vs. daily avg)". This supports Level 3 SA (projection).

4. **Consider a "Surge Mode" layout** — When `StatusBar.isSurge` is true, the current 2-column layout may be too cramped. Consider collapsing less critical widgets or expanding the escalation queue.

5. **Add resource availability as a top-level KPI** — Currently `ResponderAvailabilityPanel` is in the right column. Consider adding "Available Responders: X/Y" as a top KPI card so operators don't need to scan the table to know if they have capacity.

6. **Time-since-last-update on every widget** — In operational dashboards, stale data is worse than no data. Every widget should show when it was last updated (even if just "2m ago").

7. **Implement a "Tactical Overlay"** — During major incidents, the dashboard should be able to switch to a simplified "tactical mode" showing only: incident count, resource availability, and pending actions. This is standard EOC practice.

---

## 10. Key Takeaways

1. **Know your dashboard type** — Bantayog is operational, which means optimize for speed and action, not analysis.

2. **Follow Endsley's SA model** — Design for perception (visibility), comprehension (context), and projection (anticipation).

3. **Use the inverted pyramid** — Most critical/actionable data at the top, context below, detail last.

4. **Every element must earn its place** — If it doesn't inform a decision, remove it.

5. **Consistency saves lives** — In high-stakes environments, predictable patterns reduce errors.

6. **Dashboards are for acting, not reading** — Provide direct actions from every data point.

7. **Test with real operators** — The 5-second rule, 3-30-300 heuristic, and SAGAT-style probing are objective ways to validate your layout.

---

## Sources and Further Reading

1. **UXPin Studio** — "Effective Dashboard Design Principles for 2025" (uxpin.com/studio/blog/dashboard-design/)
2. **Endsley, M.R.** — "Toward a Theory of Situation Awareness in Dynamic Systems" (Human Factors Journal, 1995)
3. **Wikipedia** — "Situation Awareness" (en.wikipedia.org/wiki/Situation_awareness)
4. **Nielsen Norman Group** — Dashboard Design Guidelines (nngroup.com)
5. **DHS** — "Design Guidelines for Situational Awareness Technologies" (dhs.gov)
6. **Few, Stephen** — "Information Dashboard Design: Displaying Data for At-a-Glance Monitoring" (2006, 2013)
7. **Boyd, John** — OODA Loop theory (military strategic theory)
8. **Sweller, John** — Cognitive Load Theory (1988)

---

*Research compiled for the Bantayog Alert project on 2026-05-25*
