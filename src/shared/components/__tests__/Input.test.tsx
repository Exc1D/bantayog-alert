import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { Input } from '../Input'

describe('Input', () => {
  describe('when rendered', () => {
    it('should display label', () => {
      render(<Input label="Email" name="email" />)
      expect(screen.getByText('Email')).toBeInTheDocument()
    })

    it('should render input element', () => {
      render(<Input label="Email" name="email" />)
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('should have 44px min touch target', () => {
      render(<Input label="Email" name="email" />)
      const input = screen.getByRole('textbox')
      expect(input).toHaveClass('min-h-[44px]')
    })
  })

  describe('when error is provided', () => {
    it('should display error message', () => {
      render(<Input label="Email" name="email" error="Invalid email" />)
      expect(screen.getByText('Invalid email')).toBeInTheDocument()
    })

    it('should apply error styling', () => {
      render(<Input label="Email" name="email" error="Invalid email" />)
      const input = screen.getByRole('textbox')
      expect(input).toHaveClass('border-red-500')
    })
  })

  describe('when user types', () => {
    it('should call onChange handler', async () => {
      const user = userEvent.setup()
      const handleChange = vi.fn()
      render(<Input label="Email" name="email" onChange={handleChange} />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'test@example.com')

      expect(handleChange).toHaveBeenCalled()
    })
  })

  describe('accessibility', () => {
    it('should associate label with input', () => {
      render(<Input label="Email" name="email" />)
      const input = screen.getByRole('textbox')
      const label = screen.getByText('Email')

      expect(label.tagName).toBe('LABEL')
      expect(label).toHaveAttribute('for', 'email')
    })
  })
})
