import { useState } from 'react'

/**
 * Keeps typed text while focused so parent-side normalization cannot eat
 * intermediate keystrokes (e.g. "0.").
 */
export function useDraftInput(committedValue: string): {
  displayValue: string
  isDrafting: boolean
  onChange: (value: string) => void
  clearDraft: () => void
} {
  const [draft, setDraft] = useState<string | null>(null)
  return {
    displayValue: draft ?? committedValue,
    isDrafting: draft !== null,
    onChange: (value) => setDraft(value),
    clearDraft: () => setDraft(null),
  }
}
