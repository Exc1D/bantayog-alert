import { describe, it, expect } from 'vitest'
import { renderTemplate, SmsTemplateError } from './sms-templates.js'

describe('renderTemplate', () => {
  it('renders receipt_ack.tl with publicRef substitution', () => {
    const body = renderTemplate({
      purpose: 'receipt_ack',
      locale: 'tl',
      vars: { publicRef: 'abc12345' },
    })
    expect(body).toContain('abc12345')
    expect(body).not.toContain('{publicRef}')
  })

  it('renders receipt_ack.en with publicRef substitution', () => {
    const body = renderTemplate({
      purpose: 'receipt_ack',
      locale: 'en',
      vars: { publicRef: 'abc12345' },
    })
    expect(body).toContain('abc12345')
    expect(body).not.toContain('{publicRef}')
  })

  it('renders verification for both locales', () => {
    expect(
      renderTemplate({ purpose: 'verification', locale: 'tl', vars: { publicRef: 'r1r1r1r1' } }),
    ).toContain('r1r1r1r1')
    expect(
      renderTemplate({ purpose: 'verification', locale: 'en', vars: { publicRef: 'r1r1r1r1' } }),
    ).toContain('r1r1r1r1')
  })

  it('renders status_update for both locales', () => {
    expect(
      renderTemplate({ purpose: 'status_update', locale: 'tl', vars: { publicRef: 'r1r1r1r1' } }),
    ).toContain('r1r1r1r1')
    expect(
      renderTemplate({ purpose: 'status_update', locale: 'en', vars: { publicRef: 'r1r1r1r1' } }),
    ).toContain('r1r1r1r1')
  })

  it('renders resolution for both locales', () => {
    expect(
      renderTemplate({ purpose: 'resolution', locale: 'tl', vars: { publicRef: 'r1r1r1r1' } }),
    ).toContain('r1r1r1r1')
    expect(
      renderTemplate({ purpose: 'resolution', locale: 'en', vars: { publicRef: 'r1r1r1r1' } }),
    ).toContain('r1r1r1r1')
  })

  it('throws when required var is missing', () => {
    // @ts-expect-error intentionally omit required var
    expect(() => renderTemplate({ purpose: 'receipt_ack', locale: 'tl', vars: {} })).toThrow(
      SmsTemplateError,
    )
  })

  it('throws on unknown purpose', () => {
    expect(() =>
      renderTemplate({
        // @ts-expect-error invalid purpose
        purpose: 'mystery',
        locale: 'tl',
        vars: { publicRef: 'r1r1r1r1' },
      }),
    ).toThrow(SmsTemplateError)
  })

  it('throws on unknown locale', () => {
    expect(() =>
      renderTemplate({
        purpose: 'receipt_ack',
        // @ts-expect-error invalid locale
        locale: 'fr',
        vars: { publicRef: 'r1r1r1r1' },
      }),
    ).toThrow(SmsTemplateError)
  })
})
