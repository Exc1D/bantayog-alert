# Bantayog Alert — Admin Desktop Interface System

## Direction

Emergency Operations Console for Camarines Norte PDRRMO. Dark command-center aesthetic with near-black surfaces, paper-white instrumentation typography, and color used exclusively for status/severity. Glassmorphism is intentional — translucent layered panels feel like instrument readouts, not SaaS cards.

## Signature

The **Situation Strip** as operational heartbeat. The mode badge (`calm`/`active`/`degraded`/`surge`) is the pulse of the room — in `degraded`/`surge` it gains an edge-glow (`box-shadow: 0 0 12px {color}30`) and `motion-safe:animate-pulse`. The entire dashboard's mood is controlled by this single band.

## Depth Strategy

Glassmorphism on dark. `bg-white/[0.03]` with `border-white/10` for panels. No solid color surfaces for cards — translucent layering is the identity. Shadows are subtle and only on modals/overlays (`shadow-lg`).

## Color Palette

| Token                      | Value                   | Role                            |
| -------------------------- | ----------------------- | ------------------------------- |
| `--color-surface`          | `#0d0d0f`               | Canvas / EOC room darkness      |
| `--color-surface-elevated` | `#161618`               | Panel background                |
| `--color-surface-overlay`  | `#1e1e21`               | Modals, dropdowns               |
| `--color-carto-blue`       | `#4a90d9`               | Map-linked interactive elements |
| `--color-carto-blue-glow`  | `rgba(74,144,217,0.25)` | Hover/focus glow on map links   |
| `--color-success`          | `#22c55e`               | All-clear, go-signals           |
| `--color-danger`           | `#991b1b`               | Emergency, stop, stalled        |
| `--color-warning`          | `#a73400`               | Hazard lights, caution          |
| `--color-info`             | `#3b82f6`               | Neutral operational data        |
| `--color-text-primary`     | `#f1f5f9`               | Instrument illumination         |
| `--color-text-secondary`   | `#94a3b8`               | Secondary labels                |
| `--color-text-muted`       | `#64748b`               | Disabled, timestamps            |

**Rule:** Cartographic blue is reserved for map-linked interactive elements (municipality chips, map navigation, geospatial actions). It should NOT be used for general success states — use `--color-success` for those.

## Typography

- `--font-body`: `'Inter', ui-sans-serif, system-ui, sans-serif`
- `--font-mono`: `'JetBrains Mono', ui-monospace, monospace`
- Data readouts (stats, timestamps, IDs) use `font-mono` + `font-variant-numeric: tabular-nums` for alignment
- Headlines: weight 600–700, tight tracking
- Labels: uppercase, `tracking-wider`, `text-xs`, `--color-text-muted`

## Spacing

- Base unit: 4px (Tailwind default)
- Panel padding: `p-4` (16px)
- Section gap: `space-y-4` (16px)
- Metric cards gap: `gap-4` (16px)

## Border Radius

- Inputs/buttons: `rounded` (4px)
- Cards/panels: `rounded-lg` (8px)
- Modals: `rounded-xl` (12px)

## Motion

- `--ease-snap`: `cubic-bezier(0.22, 1, 0.36, 1)` — primary easing
- `--ease-dramatic`: `cubic-bezier(0.87, 0, 0.13, 1)` — mode transitions
- `--duration-micro`: `150ms` — hovers, toggles
- `--duration-standard`: `250ms` — panel transitions
- `--duration-dramatic`: `400ms` — mode changes, modal open
- Respect `prefers-reduced-motion`

## Component Patterns

### Metric Card (Instrument Panel)

```
rounded-lg border-t-[3px] border-t-{status-color} bg-white/[0.03] p-4
```

- Top-border accent indicates category (cartographic blue = active/operational, red = stalled/danger, green = success, gray = neutral)
- Monospace readout with tabular numerals
- Label in `text-xs text-gray-400`

### Mode Badge

```
rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider
```

- Dynamic `backgroundColor: {color}20`, `color: {color}`, `border: 1px solid {color}40`
- `box-shadow: 0 0 12px {color}30` when in `degraded` or `surge`
- `motion-safe:animate-pulse` in elevated modes

### Municipality Chip (Map Link)

```
rounded border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-[var(--color-carto-blue)]
hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-[var(--color-carto-blue)]/50
```

- Always renders as `<Link>` to `/map?municipality={name}`
- Cartographic blue signals map-interactive

## Component Patterns

### Dispatch Instrument Badge

```
inline-flex rounded px-2 py-0.5 text-xs font-medium
style={{ color: 'var(--color-{semantic})', backgroundColor: 'rgba({hex},0.12)' }}
```

- **Pending:** `--color-warning` on `rgba(167,52,0,0.12)` (amber/hazard glow)
- **Accepted:** `--color-info` on `rgba(59,130,246,0.12)` (blue operational)
- **Declined / Needs Admin:** `--color-danger` on `rgba(153,27,27,0.12)` (red alert)
- **Unknown / Fallback:** `--color-text-muted` on `rgba(255,255,255,0.06)` (neutral)
- No Tailwind light-mode classes (`bg-amber-100 text-amber-800`) on dark surfaces — use inline translucent backgrounds

### Dispatch Lifecycle Table Row

```
flex cursor-pointer items-center border-b border-white/5 px-3 py-2
hover:bg-white/[0.03] expanded:bg-white/[0.05]
```

- Highlighted row: `ring-2 ring-[var(--color-carto-blue)] ring-inset`
- Report ID: `font-mono text-[var(--color-text-secondary)]` with `tabular-nums`
- Responder name: `text-[var(--color-text-primary)]`
- Agency: `text-xs text-[var(--color-text-muted)]`
- Column headers: `text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]`

### Carbon-Copy Receipt Expansion

Expanded timeline panel beneath a row:

```
mt-2 rounded-md border border-white/10 bg-[var(--color-surface-elevated)] p-3
```

- Feels like pulling the carbon-copy receipt from a two-part dispatch form
- Timeline entries: `flex items-center gap-2 text-sm`, event label in `text-[var(--color-text-primary)]`, timestamp in `text-[var(--color-text-muted)]`
- "Show more/less" link uses `--color-carto-blue`

### FCM Status Icon

| Result        | Icon        | Color                            |
| ------------- | ----------- | -------------------------------- |
| sent          | CheckCircle | `text-[var(--color-success)]`    |
| network_error | XCircle     | `text-[var(--color-danger)]`     |
| no_token      | AlertCircle | `text-[var(--color-warning)]`    |
| unknown/null  | HelpCircle  | `text-[var(--color-text-muted)]` |

## Accessibility

- All metric cards have `aria-label` describing the metric
- Mode badge has `role="status"` + `aria-live="polite"`
- Focus rings use the accent color of the element (cartographic blue for map links, red for danger actions)
- `prefers-reduced-motion` disables all animation
