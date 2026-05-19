/// <reference types="@testing-library/jest-dom" />
/* eslint-disable @typescript-eslint/no-empty-function */
import { createElement, forwardRef } from 'react'
import type { ReactNode } from 'react'
import { vi } from 'vitest'

const ANIMATION_PROPS = new Set([
  'initial',
  'animate',
  'exit',
  'transition',
  'variants',
  'whileTap',
  'whileHover',
  'layoutId',
  'custom',
  'drag',
  'dragConstraints',
  'dragElastic',
  'onDragEnd',
])

function createMotionComponent(tag: string) {
  const Component = forwardRef<HTMLElement, Record<string, unknown>>((props, ref) => {
    const { children, ...rest } = props
    const htmlProps = Object.fromEntries(
      Object.entries(rest).filter(([k]) => !ANIMATION_PROPS.has(k)),
    )
    return createElement(tag, { ...htmlProps, ref }, children as ReactNode)
  })
  Component.displayName = `motion.${tag}`
  return Component
}

vi.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get: (_target: unknown, key: string) => createMotionComponent(key),
    },
  ),
  AnimatePresence: ({ children }: { children: ReactNode }) => children,
  useMotionValue: () => ({ get: () => 0, set() {}, on: () => () => {} }),
  useAnimation: () => ({ start: () => Promise.resolve(), stop() {}, set() {} }),
  useTransform: () => ({ get: () => 0 }),
  useDragControls: () => ({}),
}))
