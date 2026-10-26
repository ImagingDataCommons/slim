import type * as React from 'react'
import { createContext, useContext, useMemo, useState } from 'react'

export interface StudySummary {
  /** Formatted patient name shown in the header breadcrumb */
  patientName?: string
  /** Short study label, e.g. "S24-01542 · 12 Sep 2026" */
  studyLabel?: string
}

interface StudySummaryContextValue {
  summary: StudySummary | null
  setSummary: (summary: StudySummary | null) => void
}

const StudySummaryContext = createContext<StudySummaryContextValue>({
  summary: null,
  setSummary: () => {},
})

/** Shares the open study's patient/study label between the viewer and header. */
export function StudySummaryProvider({
  children,
}: {
  children: React.ReactNode
}): React.ReactElement {
  const [summary, setSummary] = useState<StudySummary | null>(null)
  const value = useMemo(() => ({ summary, setSummary }), [summary])
  return (
    <StudySummaryContext.Provider value={value}>
      {children}
    </StudySummaryContext.Provider>
  )
}

export function useStudySummary(): StudySummaryContextValue {
  return useContext(StudySummaryContext)
}
