import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Skeleton } from '../Skeleton'

describe('Skeleton (slice c shimmer)', () => {
  it('keeps animate-pulse as the default with no shimmer', () => {
    const { container } = render(<Skeleton data-testid="skeleton" />)
    const skeleton = container.firstElementChild
    expect(skeleton).toHaveClass('animate-pulse')
    expect(skeleton).not.toHaveClass('ytv-shimmer')
  })

  it('adds the shimmer sheen on opt-in while retaining the pulse fallback', () => {
    const { container } = render(<Skeleton shimmer data-testid="skeleton" />)
    const skeleton = container.firstElementChild
    expect(skeleton).toHaveClass('ytv-shimmer')
    expect(skeleton).toHaveClass('animate-pulse')
  })
})
