import type * as React from 'react'

/** One row of a label/value grid */
export interface KeyValueItem {
  label: string
  value: React.ReactNode
  mono?: boolean
}

/** Adapts `{ name, value }` attributes produced by the description utils */
export function toKeyValueItems(
  attributes: ReadonlyArray<{ name: string; value: React.ReactNode }>,
): KeyValueItem[] {
  return attributes.map(({ name, value }) => ({ label: name, value }))
}
