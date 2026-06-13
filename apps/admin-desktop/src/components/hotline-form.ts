import { MDRRMO_HOTLINE_REGEX } from '@bantayog/shared-validators'

export type HotlineValidationErrors = Partial<Record<'mdrrmoLabel' | 'mdrrmoHotline', string>>

export interface HotlineFormValues {
  mdrrmoLabel: string
  mdrrmoHotline: string
}

/** Only municipal admins and provincial superadmins may edit MDRRMO contact cards. */
export function canEditHotlines(claims: Record<string, unknown> | null): boolean {
  const role = claims?.role
  return role === 'municipal_admin' || role === 'provincial_superadmin'
}

export function validateHotlineForm(values: HotlineFormValues): HotlineValidationErrors {
  const errors: HotlineValidationErrors = {}
  if (!values.mdrrmoLabel.trim()) {
    errors.mdrrmoLabel = 'Office name is required'
  } else if (values.mdrrmoLabel.trim().length > 80) {
    errors.mdrrmoLabel = 'Office name must be 80 characters or fewer'
  }
  if (!MDRRMO_HOTLINE_REGEX.test(values.mdrrmoHotline)) {
    errors.mdrrmoHotline = 'Enter a valid phone number, for example (054) 721-1216'
  }
  return errors
}
