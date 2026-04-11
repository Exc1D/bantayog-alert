import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { Modal } from '../Modal'

describe('Modal', () => {
  describe('when closed', () => {
    it('should not render anything', () => {
      const { container } = render(
        <Modal isOpen={false} onClose={vi.fn()}>
          <p>Modal content</p>
        </Modal>
      )
      expect(container).toBeEmptyDOMElement()
    })
  })

  describe('when open', () => {
    it('should render children', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()}>
          <p>Modal content</p>
        </Modal>
      )
      expect(screen.getByText('Modal content')).toBeInTheDocument()
    })

    it('should render backdrop', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()}>
          <p>Content</p>
        </Modal>
      )
      expect(screen.getByTestId('modal-backdrop')).toBeInTheDocument()
    })

    it('should render modal content', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()}>
          <p>Content</p>
        </Modal>
      )
      expect(screen.getByTestId('modal-content')).toBeInTheDocument()
    })
  })

  describe('when title is provided', () => {
    it('should render title', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} title="Test Title">
          <p>Content</p>
        </Modal>
      )
      expect(screen.getByText('Test Title')).toBeInTheDocument()
    })

    it('should have aria-labelledby attribute', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} title="Test Title">
          <p>Content</p>
        </Modal>
      )
      const modal = screen.getByRole('dialog')
      expect(modal).toHaveAttribute('aria-labelledby', 'modal-title')
    })
  })

  describe('when close button is clicked', () => {
    it('should call onClose', async () => {
      const onClose = vi.fn()
      render(
        <Modal isOpen={true} onClose={onClose}>
          <p>Content</p>
        </Modal>
      )
      const closeButton = screen.getByTestId('modal-close-button')
      await userEvent.click(closeButton)
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('when backdrop is clicked', () => {
    it('should call onClose', async () => {
      const onClose = vi.fn()
      render(
        <Modal isOpen={true} onClose={onClose}>
          <p>Content</p>
        </Modal>
      )
      const backdrop = screen.getByTestId('modal-backdrop')
      await userEvent.click(backdrop)
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('when escape key is pressed', () => {
    it('should call onClose', async () => {
      const onClose = vi.fn()
      render(
        <Modal isOpen={true} onClose={onClose}>
          <p>Content</p>
        </Modal>
      )
      await userEvent.keyboard('{Escape}')
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('accessibility', () => {
    it('should have role="dialog"', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()}>
          <p>Content</p>
        </Modal>
      )
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('should have aria-modal="true"', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()}>
          <p>Content</p>
        </Modal>
      )
      const modal = screen.getByRole('dialog')
      expect(modal).toHaveAttribute('aria-modal', 'true')
    })

    it('should prevent body scroll when open', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()}>
          <p>Content</p>
        </Modal>
      )
      expect(document.body.style.overflow).toBe('hidden')
    })

    it('should restore body scroll when closed', async () => {
      const { rerender } = render(
        <Modal isOpen={true} onClose={vi.fn()}>
          <p>Content</p>
        </Modal>
      )
      rerender(
        <Modal isOpen={false} onClose={vi.fn()}>
          <p>Content</p>
        </Modal>
      )
      expect(document.body.style.overflow).toBe('')
    })
  })

  describe('when showCloseButton is false', () => {
    it('should not render close button', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} showCloseButton={false}>
          <p>Content</p>
        </Modal>
      )
      expect(
        screen.queryByTestId('modal-close-button')
      ).not.toBeInTheDocument()
    })
  })

  describe('when rendering in portal', () => {
    it('should render in document.body', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()}>
          <p>Content</p>
        </Modal>
      )
      const modal = screen.getByRole('dialog')
      expect(modal.parentElement).toBe(document.body)
    })
  })
})
