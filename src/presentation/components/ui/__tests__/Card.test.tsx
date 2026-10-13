import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Card } from '../Card'

describe('Card (slice c elevation)', () => {
  it('keeps the stable base API classes and adds layered elevation', () => {
    render(<Card data-testid="card">Body</Card>)
    const card = screen.getByTestId('card')
    expect(card).toHaveClass('shadow-sm')
    expect(card).toHaveClass('ytv-elev-1')
    expect(card).toHaveClass('bg-card')
  })

  it('does not hover-lift by default; interactive cards opt in explicitly', () => {
    render(<Card data-testid="plain">Body</Card>)
    expect(screen.getByTestId('plain')).not.toHaveClass('ytv-card-interactive--app')

    render(
      <Card data-testid="interactive" className="ytv-card-interactive--app">
        Body
      </Card>,
    )
    expect(screen.getByTestId('interactive')).toHaveClass('ytv-card-interactive--app')
    expect(screen.getByTestId('interactive')).toHaveClass('ytv-elev-1')
  })
})
