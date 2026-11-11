import { useResettableState } from './useResettableState'

export type LayerStyleUpdate<S> = (change: Partial<S>) => void

/**
 * Local copy of a layer's display style.
 *
 * - `update` applies a partial change locally and forwards it to `onCommit`.
 * - `preview` applies it locally only, for continuous input such as slider
 *   drags that are committed on release.
 *
 * The copy restarts from `initialStyle` when `resetKey` changes, which lets
 * callers follow style changes made outside the panel.
 */
export function useLayerStyle<S extends object>(
  initialStyle: S,
  onCommit: (change: Partial<S>) => void,
  resetKey?: string,
): [S, LayerStyleUpdate<S>, LayerStyleUpdate<S>] {
  const [style, setStyle] = useResettableState(initialStyle, resetKey)
  const preview: LayerStyleUpdate<S> = (change) => {
    setStyle((previous) => ({ ...previous, ...change }))
  }
  const update: LayerStyleUpdate<S> = (change) => {
    preview(change)
    onCommit(change)
  }
  return [style, update, preview]
}
