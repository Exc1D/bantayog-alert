/**
 * Municipality data for Camarines Norte
 *
 * Used across the application for location selection.
 * Sourced from ReportForm.tsx inline constant, now centralized.
 */

export const MUNICIPALITIES = ['Daet', 'Capalonga', 'Jose Panganiban', 'Labo'] as const

export type MunicipalityName = (typeof MUNICIPALITIES)[number]
