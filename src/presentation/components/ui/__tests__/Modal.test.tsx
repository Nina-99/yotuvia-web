import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Modal } from '../Modal'

describe('Modal', () => {
  it('does not render anything while closed', () => {
    render(
      <Modal open={false} onClose={vi.fn()} closeLabel="Close">
        Body
      </Modal>,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders an accessible dialog when open', () => {
    render(
      <Modal open onClose={vi.fn()} closeLabel="Close" title="Title">
        Body
      </Modal>,
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByText('Title')).toBeInTheDocument()
  })

  it('calls onClose when Escape is pressed', async () => {
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose} closeLabel="Close" title="Title">
        Body
      </Modal>,
    )

    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when the backdrop is clicked', async () => {
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose} closeLabel="Close" title="Title">
        Body
      </Modal>,
    )

    await userEvent.click(screen.getByTestId('modal-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose from the close button', async () => {
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose} closeLabel="Close">
        Body
      </Modal>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
