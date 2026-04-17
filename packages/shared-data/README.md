# @bantayog/shared-data

Barangay and municipality geodata for the Province of Camarines Norte.

## Data sources (pending licensing)

- **PSA (Philippine Statistics Authority)** — official barangay codes and hierarchy
- **PhilGIS** — barangay boundary GeoJSON (shapefiles converted)
- **Province of Camarines Norte PDRRMO** — official barangay roster validation

## Phase 0 state

This package delivers structure only (types, loader contract, README).
The actual barangay dataset is **deferred to Phase 2 prerequisite** per
design spec §11.1. It will not be committed to git — the GeoJSON will
live in Cloud Storage with signed-download endpoints. A version manifest
committed here will pin which Cloud Storage object is canonical.

## Scope

12 municipalities × ~52 barangays/municipality = ~625 barangays total.
Compressed GeoJSON expected size: 5-15 MB.
