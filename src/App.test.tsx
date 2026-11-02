import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('mostra il titolo Controllo Sito', () => {
    render(<App />)
    expect(screen.getByText('Controllo Sito')).toBeInTheDocument()
  })
})
