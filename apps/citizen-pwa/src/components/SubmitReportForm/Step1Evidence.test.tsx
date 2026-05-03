import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Step1Evidence } from './Step1Evidence.js'

function makeFile(name: string, type: string, sizeBytes: number): File {
  // Allocate a typed array but lie about its size via a getter — happy-dom honors
  // the actual byte length, so we set sizeBytes via Object.defineProperty.
  const file = new File([new Uint8Array(0)], name, { type })
  Object.defineProperty(file, 'size', { value: sizeBytes })
  return file
}

function renderStep1() {
  const onNext = vi.fn()
  const onBack = vi.fn()
  const utils = render(<Step1Evidence onNext={onNext} onBack={onBack} />)
  return { onNext, onBack, ...utils }
}

describe('Step1Evidence — photo validation', () => {
  it('rejects non-image MIME types', () => {
    renderStep1()
    const input = screen.getByLabelText<HTMLInputElement>(/upload photo/i)
    const badFile = makeFile('virus.exe', 'application/x-msdownload', 1000)

    fireEvent.change(input, { target: { files: [badFile] } })

    expect(screen.getByRole('alert')).toHaveTextContent(/JPG, PNG, or WebP/i)
    expect(input.value).toBe('')
  })

  it('rejects images larger than 20 MB', () => {
    renderStep1()
    const input = screen.getByLabelText<HTMLInputElement>(/upload photo/i)
    const tooBig = makeFile('huge.jpg', 'image/jpeg', 21 * 1024 * 1024)

    fireEvent.change(input, { target: { files: [tooBig] } })

    expect(screen.getByRole('alert')).toHaveTextContent(/Maximum size is 20 MB/i)
    expect(input.value).toBe('')
  })

  it('accepts a valid JPG within size limit', () => {
    renderStep1()
    const input = screen.getByLabelText<HTMLInputElement>(/upload photo/i)
    const goodFile = makeFile('photo.jpg', 'image/jpeg', 200_000)

    fireEvent.change(input, { target: { files: [goodFile] } })

    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByText('photo.jpg')).toBeInTheDocument()
  })
})

describe('Step1Evidence — incident type validation', () => {
  it('disables Continue button when no type selected on mount', () => {
    renderStep1()
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()
  })

  it('Skip photo button shows error when no type selected', () => {
    renderStep1()
    fireEvent.click(screen.getByRole('button', { name: /skip photo/i }))
    expect(screen.getByRole('alert')).toHaveTextContent(/select an incident type/i)
  })

  it('Skip photo advances when type is explicitly selected', () => {
    const { onNext } = renderStep1()
    fireEvent.click(screen.getByRole('button', { name: /^flood$/i }))
    fireEvent.click(screen.getByRole('button', { name: /skip photo/i }))
    expect(onNext).toHaveBeenCalledWith(
      expect.objectContaining({ reportType: 'flood', photoFile: null }),
    )
  })
})
