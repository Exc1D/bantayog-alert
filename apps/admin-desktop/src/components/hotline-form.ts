import {
  MDRRMO_HOTLINE_REGEX,
  MIN_MDRRMO_HOTLINE_DIGITS,
  countHotlineDigits,
  mdrrmoLabelSchema,
} from '@bantayog/shared-validators'

export type HotlineValidationErrors = Partial<Record<'mdrrmoLabel' | 'mdrrmoHotline', string>>

const MDRRMO_LABEL_MAX_LENGTH = mdrrmoLabelSchema.maxLength ?? 80

export interface HotlineFormValues {
  mdrrmoLabel: string
  mdrrmoHotline: string
}

/** Only municipal admins and provincial superadmins may edit MDRRMO contact cards. */
export function canEditHotlines(claims: Record<string, unknown> | null): boolean {
  const role = claims?.role
  return role === 'municipal_admin' || role === 'provincial_superadmin'
}

export function normalizeHotlineForm(values: HotlineFormValues): HotlineFormValues {
  return {
    mdrrmoLabel: values.mdrrmoLabel.trim(),
    mdrrmoHotline: values.mdrrmoHotline.trim(),
  }
}

export function validateHotlineForm(values: HotlineFormValues): HotlineValidationErrors {
  const errors: HotlineValidationErrors = {}
  const normalized = normalizeHotlineForm(values)
  if (!normalized.mdrrmoLabel) {
    errors.mdrrmoLabel = 'Office name is required'
  } else if (normalized.mdrrmoLabel.length > MDRRMO_LABEL_MAX_LENGTH) {
    errors.mdrrmoLabel = `Office name must be ${String(MDRRMO_LABEL_MAX_LENGTH)} characters or fewer`
  }
  if (
    !MDRRMO_HOTLINE_REGEX.test(normalized.mdrrmoHotline) ||
    countHotlineDigits(normalized.mdrrmoHotline) < MIN_MDRRMO_HOTLINE_DIGITS
  ) {
    errors.mdrrmoHotline = 'Enter a valid phone number, for example (054) 721-1216'
  }
  return errors
}
