import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Button } from '../Button';

describe('Button', () => {
  describe('when rendered', () => {
    it('should render children text', () => {
      render(<Button>Click me</Button>);
      expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
    });
  });

  describe('when primary variant', () => {
    it('should apply primary styles', () => {
      render(<Button variant="primary">Submit</Button>);
      const button = screen.getByRole('button', { name: /submit/i });
      expect(button).toHaveClass('bg-primary-blue');
      expect(button).toHaveClass('text-white');
    });
  });

  describe('when secondary variant', () => {
    it('should apply secondary styles', () => {
      render(<Button variant="secondary">Cancel</Button>);
      const button = screen.getByRole('button', { name: /cancel/i });
      expect(button).toHaveClass('bg-gray-200');
      expect(button).toHaveClass('text-gray-800');
    });
  });

  describe('when danger variant', () => {
    it('should apply danger styles', () => {
      render(<Button variant="danger">Delete</Button>);
      const button = screen.getByRole('button', { name: /delete/i });
      expect(button).toHaveClass('bg-primary-red');
      expect(button).toHaveClass('text-white');
    });
  });

  describe('when disabled', () => {
    it('should be disabled', () => {
      render(<Button disabled>Disabled</Button>);
      const button = screen.getByRole('button', { name: /disabled/i });
      expect(button).toBeDisabled();
    });

    it('should apply disabled styles', () => {
      render(<Button variant="primary" disabled>Disabled</Button>);
      const button = screen.getByRole('button', { name: /disabled/i });
      expect(button).toHaveClass('disabled:bg-gray-400');
    });
  });

  describe('accessibility', () => {
    it('should have 44px minimum touch target', () => {
      render(<Button>Accessible Button</Button>);
      const button = screen.getByRole('button', { name: /accessible button/i });
      expect(button).toHaveClass('min-h-[44px]');
    });
  });
});
