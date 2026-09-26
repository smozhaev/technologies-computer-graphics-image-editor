import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'
import { renderWithProviders } from '@/shared/lib/test'

describe('App', () => {
  it('renders the shell', () => {
    renderWithProviders(<App />)
    expect(screen.getByRole('button', { name: 'Файл' })).toBeInTheDocument()
  })
})
