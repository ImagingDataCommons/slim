/**
 * Registers a minimal browser-like global for `bun test` (jsdom is Jest-only here).
 * Official CI still uses `npm test` / craco.
 *
 * happy-dom types intentionally do not match lib.dom; use loose assignments so
 * this file typechecks under CRA `tsc` while Bun still runs it as preload.
 */
import { GlobalWindow } from 'happy-dom'

const w = new GlobalWindow({ url: 'http://localhost/' })

const gt = globalThis as Record<string, unknown>
gt.window = w
gt.document = w.document

globalThis.getComputedStyle = ((element: unknown, _pseudoElt?: string | null) =>
  w.getComputedStyle(
    element as never,
  )) as unknown as typeof globalThis.getComputedStyle

globalThis.matchMedia = w.matchMedia.bind(
  w,
) as unknown as typeof globalThis.matchMedia

/** rc-table / antd use global `Element` in `instanceof` checks */
const domCtors = [
  'Element',
  'HTMLElement',
  'HTMLDivElement',
  'HTMLTableElement',
  'HTMLTableSectionElement',
  'HTMLTableRowElement',
  'HTMLTableCellElement',
  'Node',
  'DocumentFragment',
  'Text',
  'Comment',
  'Event',
  'CustomEvent',
  'MouseEvent',
] as const
for (const name of domCtors) {
  const ctor = (w as unknown as Record<string, unknown>)[name]
  if (typeof ctor === 'function') {
    gt[name] = ctor
  }
}

if (typeof globalThis.requestAnimationFrame !== 'function') {
  const handles = new Map<number, ReturnType<typeof w.setTimeout>>()
  let nextRafId = 1
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback): number => {
    const handle = w.setTimeout(() => {
      cb(Date.now())
    }, 0)
    const id = nextRafId++
    handles.set(id, handle)
    return id
  }
  globalThis.cancelAnimationFrame = (id: number): void => {
    const handle = handles.get(id)
    if (handle !== undefined) {
      w.clearTimeout(handle)
      handles.delete(id)
    }
  }
}
