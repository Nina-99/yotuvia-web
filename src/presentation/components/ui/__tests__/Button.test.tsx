import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Button } from '../Button'
import type { ButtonVariant } from '../Button'

const VARIANT_MARKERS: Record<ButtonVariant, string> = {
  primary: 'bg-accent',
  secondary: 'bg-card2',
  outline: 'border-border',
  ghost: 'bg-transparent',
  danger: 'bg-danger',
}

describe('Button', () => {
  it('renders its children', () => {
    render(<Button>Save</Button>)
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })

  it.each(Object.entries(VARIANT_MARKERS))(
    'applies the %s variant classes',
    (variant, marker) => {
      render(<Button variant={variant as ButtonVariant}>Action</Button>)
      expect(screen.getByRole('button', { name: 'Action' }).className).toContain(marker)
    },
  )

  it('does not fire onClick when disabled', async () => {
    const onClick = vi.fn()
    render(
      <Button disabled onClick={onClick}>
        Disabled
      </Button>,
    )

    const button = screen.getByRole('button', { name: 'Disabled' })
    expect(button).toBeDisabled()
    await userEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('shows a loading state and blocks interaction', async () => {
    const onClick = vi.fn()
    render(
      <Button loading onClick={onClick}>
        Saving
      </Button>,
    )

    const button = screen.getByRole('button', { name: 'Saving' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(button.querySelector('svg')).not.toBeNull()

    await userEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })
})
