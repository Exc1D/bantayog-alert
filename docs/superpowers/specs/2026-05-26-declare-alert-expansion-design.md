# Design Spec: Expanded Declare Alert for admin-desktop

**Date:** 2026-05-26  
**Status:** Approved  
**Scope:** admin-desktop `DeclareAlertModal` + backend `declareAlert` callable + shared validators

---

## 1. Problem Statement

The current "Declare Alert" feature supports 10 generic hazard types (flood, typhoon, earthquake, fire, landslide, volcanic eruption, tsunami, drought, security, other). PDRRMO admins need to declare a broader range of early warnings and advisories, including:

- **Scheduled power interruptions**
- **Heat/temperature advisories** (PAGASA-aligned)
- **Road/bridge closure advisories** (due to flood, landslide, accidents, maintenance)
- **Class/work/transport suspensions** (due to weather or any hazard)
- **Pre-emptive evacuations** and **evacuation orders**
- **Health advisories** and **disease outbreak alerts**
- **State of calamity** declarations
- **Curfew** orders

Additionally, the current form lacks:

- Temporal boundaries (start/end times, expected resolution)
- Sector-level targeting (which schools, offices, businesses are affected)
- Barangay-level granularity (the current municipality-only scope is too broad for road closures and targeted power interruptions)

---

## 2. Goals

1. **Expand the `hazardType` enum** from 10 to 36 specific, PDRRMO-aligned alert types organized in 6 visual groups.
2. **Add temporal fields**: `effectiveFrom`, `effectiveUntil`, `expectedResolutionAt` (all optional, with `effectiveFrom`/`effectiveUntil` required for scheduled advisories).
3. **Add sector targeting**: `affectedSectors` (multi-select array).
4. **Add barangay targeting**: Optional `affectedBarangayIds` (multi-select, municipality-driven drill-down, hidden by default).
5. **Add road name**: `roadName` (conditional string, shown for road/bridge closure types).
6. **Maintain backward compatibility**: Zero migration. Existing alert docs remain valid.

---

## 3. Non-Goals

- **Custom dropdown component**: We use the native `<select>` with `<optgroup>` for the type selector. A custom searchable dropdown is deferred until user feedback indicates the 36-item list is too unwieldy.
- **Citizen PWA changes**: This spec only covers the admin-desktop form and backend callable. Citizen-side rendering of new fields is out of scope.
- **Responder app changes**: Responder-side alert detail rendering is out of scope.
- **Push notification template per type**: FCM push title/body remain generic (`title: "Alert Issued"`, `body: <message>`). Per-type notification templates are a future enhancement.
- **Analytics dashboard grouping**: Deriving category-level analytics from the flat `hazardType` enum is deferred. We will maintain a static `CATEGORY_BY_TYPE` map in code for future use.

---

## 4. UX Design

### 4.1 Form Field Order

1. **Alert Type** (required) — Flat grouped `<select>` with `<optgroup>` headers
2. **Affected Municipalities** (required) — Existing checkbox grid
3. **"+ Specify barangays (advanced)"** toggle (hidden by default)
4. **Affected Sectors** (optional) — Multi-select checkboxes
5. **Effective Period** — From / Until datetime-local inputs
6. **Expected Resolution** (optional) — datetime-local input
7. **Road / Route Name** (conditional) — Text input, shown for `road_closure` and `bridge_closure`
8. **Message** (required) — Textarea, 500 char limit
9. **Footer** — Cancel + Declare Alert buttons

### 4.2 Barangay Selector Behavior

- **Hidden by default.** Only appears after admin clicks "+ Specify barangays (advanced)".
- **Municipality-driven.** Only barangays belonging to _selected_ municipalities are shown. If Basud is unchecked, its barangays don't appear.
- **"Select all" toggle per municipality.** Each municipality group has a master checkbox that selects/deselects all its barangays.
- **Auto-sync with municipalities.** If a municipality is unchecked in the main grid, its barangay section disappears and all its barangays are deselected.
- **Default = all barangays.** If barangay selector is NOT expanded, the backend treats the alert as affecting the entire municipality (all barangays).
- **Multiple barangays across multiple municipalities.** Admin can pick Daet (2 barangays) + Basud (3 barangays) in one alert.

### 4.3 Conditional Behaviors by Type

| Type                                                                    | Extra Fields / Behaviors                                        |
| ----------------------------------------------------------------------- | --------------------------------------------------------------- |
| `road_closure`, `bridge_closure`                                        | Shows **Road / Route Name**                                     |
| `class_suspension`                                                      | Pre-checks **Public Schools + Private Schools** in Sectors      |
| `work_suspension`                                                       | Pre-checks **Government Offices + Private Business** in Sectors |
| `scheduled_power_interruption`                                          | Makes **Effective From/Until required**                         |
| `class_suspension`, `work_suspension`, `transport_suspension`, `curfew` | Makes **Effective From/Until required**                         |
| All other types                                                         | Effective From/Until **optional**; Expected Resolution optional |

### 4.4 Sector Options

- `public_schools`
- `private_schools`
- `government_offices`
- `private_business`
- `healthcare`
- `transportation`
- `all` (meta-option; selecting `all` clears and disables the others)

### 4.5 Loading, Error, and Success States

- **Loading:** Submit button shows spinner, disables Cancel. All form fields disabled during submit.
- **Error:** Backend validation errors bubble to parent via `onError`. Field-level inline validation (e.g., "Until must be after From") runs before submission.
- **Success:** Parent page shows toast (`onSuccess`), modal closes, form resets.
- **Offline:** If `navigator.onLine === false`, show inline banner "You appear to be offline. Alert will be submitted when connection is restored." (best-effort, does not block submission if user chooses to retry).

---

## 5. Data Model

### 5.1 Firestore `alerts` Document Schema (Additive)

Existing fields remain unchanged:

```ts
interface AlertDoc {
  alertId: string
  alertType: 'alert'
  hazardType: string // expanded enum (36 values)
  affectedMunicipalityIds: string[]
  message: string
  declaredBy: string
  declaredAt: number
  publishedAt: number
  schemaVersion: 1
  reportId?: string
}
```

**New optional fields (additive, no migration):**

```ts
  effectiveFrom?: number        // epoch ms
  effectiveUntil?: number       // epoch ms
  expectedResolutionAt?: number // epoch ms
  affectedSectors?: string[]    // ['public_schools', 'private_schools']
  affectedBarangayIds?: string[] // ['Alawihao', 'Bagasbas', 'Angas']
  roadName?: string             // 'Maharlika Highway'
```

### 5.2 Backend Input Schema (`declareAlert` callable)

```ts
const declareAlertInputSchema = z.object({
  hazardType: z.enum(HAZARD_TYPES),
  affectedMunicipalityIds: z.array(z.string().min(1)).min(1),
  message: z.string().min(1).max(500),
  reportId: z.uuid().optional(),
  // New fields (all optional):
  effectiveFrom: z.number().int().optional(),
  effectiveUntil: z.number().int().optional(),
  expectedResolutionAt: z.number().int().optional(),
  affectedSectors: z.array(z.enum(SECTOR_TYPES)).optional(),
  affectedBarangayIds: z.array(z.string().min(1)).optional(),
  roadName: z.string().min(1).max(200).optional(),
})
```

**Validation rules:**

- If `hazardType === 'scheduled_power_interruption'` → `effectiveFrom` and `effectiveUntil` are **required**.
- If `hazardType` is in `['class_suspension', 'work_suspension', 'transport_suspension', 'curfew']` → `effectiveFrom` and `effectiveUntil` are **required**.
- If both `effectiveFrom` and `effectiveUntil` are present → `effectiveUntil` must be > `effectiveFrom`.
- If `roadName` is present → `hazardType` must be `road_closure` or `bridge_closure`.
- If `affectedBarangayIds` is present → every barangay must belong to at least one of `affectedMunicipalityIds`. (This is a backend validation to prevent orphan barangays.)

### 5.3 Hazard Type Enum (36 values, 6 groups)

```ts
const HAZARD_TYPES = [
  // 🌧️ Weather & Flood
  'tropical_cyclone',
  'heavy_rainfall_warning',
  'thunderstorm_advisory',
  'flood_advisory',
  'storm_surge_warning',
  'gale_warning',
  'heat_index_warning',
  'cold_surge_advisory',
  // 🌋 Geophysical & Natural
  'earthquake',
  'volcanic_eruption',
  'landslide',
  'tsunami_warning',
  'drought',
  'fire',
  // 🔌 Utilities & Infrastructure
  'scheduled_power_interruption',
  'emergency_power_interruption',
  'water_service_interruption',
  'road_closure',
  'bridge_closure',
  'telecommunication_outage',
  'structural_damage',
  // 📋 Public Service Orders
  'class_suspension',
  'work_suspension',
  'transport_suspension',
  'curfew',
  'state_of_calamity',
  'preemptive_evacuation',
  'evacuation_order',
  // 🛡️ Security & Health
  'security_incident',
  'crime_alert',
  'health_advisory',
  'disease_outbreak',
  // ⚪ Other
  'other',
] as const
```

### 5.4 Category Mapping (for future analytics, not stored)

```ts
const CATEGORY_BY_TYPE: Record<HazardType, string> = {
  tropical_cyclone: 'weather_and_flood',
  heavy_rainfall_warning: 'weather_and_flood',
  // ... etc
  other: 'other',
}
```

### 5.5 Sector Enum

```ts
const SECTOR_TYPES = [
  'public_schools',
  'private_schools',
  'government_offices',
  'private_business',
  'healthcare',
  'transportation',
  'all',
] as const
```

### 5.6 Barangay Data Source

Barangays are sourced from `@bantayog/shared-sms-parser` gazetteer. The `DeclareAlertModal` imports the gazetteer and filters by selected municipalities.

**Gazetteer shape:**

```ts
interface BarangayEntry {
  name: string // e.g., 'Alawihao'
  municipality: string // e.g., 'Daet'
}
```

**Mapping to municipality IDs:** The gazetteer uses municipality _names_ (e.g., 'Daet'), while the form uses municipality _IDs_ (e.g., 'daet'). We maintain a `MUNICIPALITY_NAME_TO_ID` map derived from `CAMARINES_NORTE_MUNICIPALITIES`.

---

## 6. Architecture

### 6.1 Files to Change

| File                                                      | Change                                                                         |
| --------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `apps/admin-desktop/src/components/DeclareAlertModal.tsx` | Full rewrite of form fields, add state for new fields, add barangay drill-down |
| `functions/src/domains/alerts/callables.ts`               | Expand `HAZARD_TYPES`, add new input schema fields, add validation rules       |
| `packages/shared-validators/src/alerts.ts`                | Expand `alertSchema` or add new `declareAlertInputSchema` export               |

### 6.2 Component State (React)

```ts
interface FormState {
  hazardType: string
  selectedMunicipalityIds: Set<string>
  showBarangaySelector: boolean
  selectedBarangayIds: Set<string>
  selectedSectors: Set<string>
  effectiveFrom: string // ISO string for datetime-local input
  effectiveUntil: string
  expectedResolutionAt: string
  roadName: string
  message: string
}
```

### 6.3 Backend Flow (unchanged structure)

1. `declareAlert` callable receives input.
2. `declareAlertInputSchema` validates (including new conditional rules).
3. `municipal_admin` role check (unchanged).
4. Rate limit check (unchanged).
5. Build alert doc with new optional fields.
6. Write to Firestore `alerts` collection.
7. Best-effort FCM push (unchanged).
8. Stream audit event (unchanged).

---

## 7. Error Handling

### 7.1 Inline Validation (Frontend)

| Field                            | Rule                                          | Message                                            |
| -------------------------------- | --------------------------------------------- | -------------------------------------------------- |
| `hazardType`                     | Required                                      | "Select an alert type"                             |
| `affectedMunicipalityIds`        | Min 1                                         | "Select at least one municipality"                 |
| `effectiveUntil`                 | If present, must be > `effectiveFrom`         | "End time must be after start time"                |
| `effectiveFrom`/`effectiveUntil` | Required for scheduled/power/suspension types | "Effective period is required for this alert type" |
| `roadName`                       | Required when type = road/bridge closure      | "Road name is required for road/bridge closures"   |

### 7.2 Backend Validation

Same rules as frontend, plus:

- `affectedBarangayIds` must all belong to selected municipalities.
- `message` max 500 chars.
- `roadName` max 200 chars.

### 7.3 Error Display

- Inline errors shown next to fields.
- Backend validation failures bubble via `onError` to parent page toast.
- Generic catch-all: "Failed to declare alert. Please check your inputs and try again."

---

## 8. Accessibility

- All form inputs have `<label>` elements with `htmlFor`.
- `aria-required` on required fields.
- `aria-describedby` on fields with helper text (e.g., "Required for scheduled power interruption").
- Barangay toggle button has `aria-expanded` and `aria-controls`.
- Focus trap remains active in modal.
- Keyboard navigation: Tab through fields, Space/Enter to toggle checkboxes, Escape to close (with unsaved changes warning).

---

## 9. Testing Strategy

### 9.1 Unit Tests (admin-desktop)

- `DeclareAlertModal.test.tsx`:
  - Renders with all 36 types in `<optgroup>` structure.
  - Shows/hides barangay selector on toggle.
  - Auto-syncs barangays when municipalities change.
  - Pre-checks sectors for `class_suspension` and `work_suspension`.
  - Shows `roadName` for `road_closure` / `bridge_closure`.
  - Requires `effectiveFrom`/`effectiveUntil` for scheduled power interruption.
  - Validates `effectiveUntil > effectiveFrom`.
  - Submits correct payload to `callables.declareAlert`.
  - Handles `onError` and `onSuccess`.

### 9.2 Unit Tests (backend)

- `functions/src/domains/alerts/__tests__/callables.test.ts`:
  - Accepts new optional fields.
  - Rejects invalid `effectiveUntil < effectiveFrom`.
  - Requires `effectiveFrom`/`effectiveUntil` for `scheduled_power_interruption`.
  - Rejects `roadName` for non-road types.
  - Rejects `affectedBarangayIds` with orphan barangays.
  - Existing tests still pass (backward compatibility).

### 9.3 E2E Tests

- Update `e2e-tests/specs/full-loop.spec.ts` to select new alert type and verify temporal fields.

---

## 10. Risks

| Risk                                            | Mitigation                                                                                                  |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 36-item dropdown is overwhelming                | Start with native `<select>`; upgrade to custom searchable dropdown if feedback demands it.                 |
| Barangay data out of sync with gazetteer        | Barangays are already used by SMS parser; same source of truth.                                             |
| Citizen PWA doesn't show new fields             | Out of scope for this spec. Existing `message` and `hazardType` still render correctly.                     |
| Admins don't understand new type names          | Type labels are descriptive (e.g., "Scheduled Power Interruption" not "Power"). Tooltip/help text deferred. |
| Backend validation rejects valid frontend input | Ensure frontend and backend schemas stay in sync. Use shared validators package.                            |

---

## 11. Rollback Plan

If the expanded form causes issues:

1. Revert `DeclareAlertModal.tsx` to previous version (10 types, no new fields).
2. Backend remains backward-compatible — old frontend submits valid payloads.
3. No Firestore migration needed since new fields are optional.

---

## 12. Open Questions (resolved during brainstorming)

| Question               | Resolution                                                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Category vs flat list? | **Flat grouped list** — merged into single `<select>` with `<optgroup>` headers.                                                     |
| Temporal fields?       | **`effectiveFrom` + `effectiveUntil` required for scheduled/suspension types; `expectedResolutionAt` optional for all.**             |
| Sector targeting?      | **Multi-select checkboxes: public_schools, private_schools, government_offices, private_business, healthcare, transportation, all.** |
| Barangay targeting?    | **Hidden by default, municipality-driven drill-down with "select all" per municipality.**                                            |
| Road name field?       | **Conditional text input, shown for `road_closure` and `bridge_closure`.**                                                           |

---

_Spec approved by user on 2026-05-26. Ready for implementation plan._
