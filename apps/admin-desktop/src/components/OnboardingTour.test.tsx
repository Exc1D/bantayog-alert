import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OnboardingTour } from '../components/OnboardingTour'
import { TOUR_STEPS } from '../hooks/useOnboarding'

function createState(currentStep: number, isActive = true) {
  return {
    isActive,
    currentStep,
    steps: TOUR_STEPS,
  }
}

describe('OnboardingTour', () => {
  it('renders nothing when inactive', () => {
    const { container } = render(
      <OnboardingTour
        state={createState(0, false)}
        onNext={vi.fn()}
        onPrev={vi.fn()}
        onSkip={vi.fn()}
        onGoToStep={vi.fn()}
      />,
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('renders tooltip with step title and description', () => {
    render(
      <OnboardingTour
        state={createState(0)}
        onNext={vi.fn()}
        onPrev={vi.fn()}
        onSkip={vi.fn()}
        onGoToStep={vi.fn()}
      />,
    )

    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'Tour step 1 of 4')
    const firstStep = TOUR_STEPS[0]
    if (!firstStep) throw new Error('TOUR_STEPS is empty')
    expect(screen.getByText(firstStep.title)).toBeInTheDocument()
    expect(screen.getByText(firstStep.description)).toBeInTheDocument()
  })

  it('calls onNext when next button clicked', () => {
    const onNext = vi.fn()
    render(
      <OnboardingTour
        state={createState(0)}
        onNext={onNext}
        onPrev={vi.fn()}
        onSkip={vi.fn()}
        onGoToStep={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByText('Next'))
    expect(onNext).toHaveBeenCalled()
  })

  it('calls onSkip when skip button clicked', () => {
    const onSkip = vi.fn()
    render(
      <OnboardingTour
        state={createState(0)}
        onNext={vi.fn()}
        onPrev={vi.fn()}
        onSkip={onSkip}
        onGoToStep={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByLabelText('Skip tour'))
    expect(onSkip).toHaveBeenCalled()
  })

  it('calls onPrev when back button clicked', () => {
    const onPrev = vi.fn()
    render(
      <OnboardingTour
        state={createState(1)}
        onNext={vi.fn()}
        onPrev={onPrev}
        onSkip={vi.fn()}
        onGoToStep={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByText('Back'))
    expect(onPrev).toHaveBeenCalled()
  })

  it('disables back button on first step', () => {
    render(
      <OnboardingTour
        state={createState(0)}
        onNext={vi.fn()}
        onPrev={vi.fn()}
        onSkip={vi.fn()}
        onGoToStep={vi.fn()}
      />,
    )

    const backButton = screen.getByText('Back')
    expect(backButton).toBeDisabled()
  })

  it('shows finish button on last step', () => {
    render(
      <OnboardingTour
        state={createState(3)}
        onNext={vi.fn()}
        onPrev={vi.fn()}
        onSkip={vi.fn()}
        onGoToStep={vi.fn()}
      />,
    )

    expect(screen.getByText('Finish')).toBeInTheDocument()
    expect(screen.queryByText('Next')).not.toBeInTheDocument()
  })

  it('renders step indicators', () => {
    render(
      <OnboardingTour
        state={createState(1)}
        onNext={vi.fn()}
        onPrev={vi.fn()}
        onSkip={vi.fn()}
        onGoToStep={vi.fn()}
      />,
    )

    const indicators = screen.getAllByRole('button', { name: /Go to step/ })
    expect(indicators).toHaveLength(4)
  })

  it('calls onGoToStep when indicator clicked', () => {
    const onGoToStep = vi.fn()
    render(
      <OnboardingTour
        state={createState(0)}
        onNext={vi.fn()}
        onPrev={vi.fn()}
        onSkip={vi.fn()}
        onGoToStep={onGoToStep}
      />,
    )

    fireEvent.click(screen.getByLabelText('Go to step 3'))
    expect(onGoToStep).toHaveBeenCalledWith(2)
  })

  it('supports keyboard navigation', () => {
    const onNext = vi.fn()
    const onPrev = vi.fn()
    const onSkip = vi.fn()

    render(
      <OnboardingTour
        state={createState(1)}
        onNext={onNext}
        onPrev={onPrev}
        onSkip={onSkip}
        onGoToStep={vi.fn()}
      />,
    )

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onSkip).toHaveBeenCalled()

    fireEvent.keyDown(document, { key: 'ArrowRight' })
    expect(onNext).toHaveBeenCalled()

    fireEvent.keyDown(document, { key: 'ArrowLeft' })
    expect(onPrev).toHaveBeenCalled()
  })
})
