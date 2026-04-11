import React, { useEffect, useRef, useCallback } from 'react'
import { X } from 'lucide-react'
import { createPortal } from 'react-dom'

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  showCloseButton?: boolean
}

/**
 * Modal component with backdrop, close functionality, and accessibility features.
 * Renders in a React Portal to avoid z-index issues.
 *
 * @param isOpen - Whether the modal is visible
 * @param onClose - Callback when modal should close
 * @param title - Optional title displayed in header
 * @param children - Modal content
 * @param showCloseButton - Whether to show X button (default: true)
 */
export function Modal({
  isOpen,
  onClose,
  title,
  children,
  showCloseButton = true,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const previousActiveElement = useRef<HTMLElement | null>(null)

  // Handle escape key press
  const handleEscape = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose()
      }
    },
    [isOpen, onClose]
  )

  // Focus trap implementation
  const trapFocus = useCallback((event: KeyboardEvent) => {
    if (event.key !== 'Tab') return

    const modal = modalRef.current
    if (!modal) return

    const focusableElements = modal.querySelectorAll<
      HTMLElement
    >(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    if (event.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstElement) {
        event.preventDefault()
        lastElement?.focus()
      }
    } else {
      // Tab
      if (document.activeElement === lastElement) {
        event.preventDefault()
        firstElement?.focus()
      }
    }
  }, [])

  // Store previous active element and set up focus management
  useEffect(() => {
    if (isOpen) {
      // Store the currently focused element
      previousActiveElement.current = document.activeElement as HTMLElement

      // Focus the modal when it opens
      modalRef.current?.focus()

      // Prevent body scroll
      document.body.style.overflow = 'hidden'

      // Add event listeners
      document.addEventListener('keydown', handleEscape)
      document.addEventListener('keydown', trapFocus)
    } else {
      // Restore body scroll
      document.body.style.overflow = ''

      // Remove event listeners
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('keydown', trapFocus)

      // Restore focus to previous element
      if (previousActiveElement.current) {
        previousActiveElement.current.focus()
      }
    }

    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('keydown', trapFocus)
    }
  }, [isOpen, handleEscape, trapFocus])

  // Don't render anything if closed
  if (!isOpen) {
    return null
  }

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
        data-testid="modal-backdrop"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col animate-slide-up sm:animate-fade-in"
        tabIndex={-1}
        data-testid="modal-content"
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            {title && (
              <h2
                id="modal-title"
                className="text-lg font-semibold text-gray-900"
              >
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                aria-label="Close modal"
                data-testid="modal-close-button"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="overflow-y-auto p-4" data-testid="modal-children">
          {children}
        </div>
      </div>
    </div>
  )

  // Render in portal
  return createPortal(modalContent, document.body)
}
