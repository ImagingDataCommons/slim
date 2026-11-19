import { ArrowUpRight, MoveHorizontal } from 'lucide-react'
import { type KeyboardEvent, useId, useRef, useState } from 'react'

export interface PreviewTab {
  id: string
  label: string
  screenshot: string
  caption: string
  href?: string
}

interface ProductPreviewProps {
  tabs: PreviewTab[]
}

/**
 * Screenshots of the app with a light/dark compare slider. The slider is a
 * native range input stretched over the image, so it works with a pointer,
 * the keyboard and screen readers without extra wiring.
 */
export default function ProductPreview({ tabs }: ProductPreviewProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [split, setSplit] = useState(50)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const baseId = useId()
  const active = tabs[activeIndex]

  const focusTab = (index: number): void => {
    const next = (index + tabs.length) % tabs.length
    setActiveIndex(next)
    tabRefs.current[next]?.focus()
  }

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (event.key === 'ArrowRight') focusTab(activeIndex + 1)
    else if (event.key === 'ArrowLeft') focusTab(activeIndex - 1)
    else if (event.key === 'Home') focusTab(0)
    else if (event.key === 'End') focusTab(tabs.length - 1)
    else return
    event.preventDefault()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="App views"
          className="inline-flex rounded-lg bg-segmented p-[3px]"
        >
          {tabs.map((tab, index) => {
            const selected = index === activeIndex
            return (
              <button
                key={tab.id}
                ref={(element) => {
                  tabRefs.current[index] = element
                }}
                id={`${baseId}-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`${baseId}-panel`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActiveIndex(index)}
                onKeyDown={onTabKeyDown}
                className={
                  selected
                    ? 'rounded-md bg-segmented-active px-3 py-1.5 text-13 font-medium text-ink shadow-segmented'
                    : 'rounded-md px-3 py-1.5 text-13 text-ink-secondary hover:text-ink'
                }
              >
                {tab.label}
              </button>
            )
          })}
        </div>
        <p className="flex items-center gap-1.5 text-12 text-ink-muted">
          <MoveHorizontal className="size-3.5" aria-hidden="true" />
          Drag to compare the dark and light themes
        </p>
      </div>

      <div
        id={`${baseId}-panel`}
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-${active.id}`}
        className="flex flex-col gap-3"
      >
        <div className="relative overflow-hidden rounded-card border border-line bg-viewport shadow-modal has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-primary">
          <img
            src={`/screenshots/${active.screenshot}-dark.webp`}
            alt={`${active.caption} (dark theme)`}
            width={1440}
            height={900}
            className="block h-auto w-full select-none"
            draggable={false}
          />
          <img
            src={`/screenshots/${active.screenshot}-light.webp`}
            alt=""
            aria-hidden="true"
            width={1440}
            height={900}
            className="absolute inset-0 block h-full w-full select-none"
            style={{ clipPath: `inset(0 0 0 ${split}%)` }}
            draggable={false}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-primary"
            style={{ left: `${split}%` }}
          >
            <span className="absolute top-1/2 left-1/2 flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-primary bg-panel text-primary shadow-menu">
              <MoveHorizontal className="size-4" />
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={split}
            onChange={(event) => setSplit(Number(event.target.value))}
            aria-label="Theme comparison: dark on the left, light on the right"
            aria-valuetext={`${split}% dark`}
            className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-13 text-ink-secondary">{active.caption}</p>
          {active.href && (
            <a
              href={active.href}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1 text-13 font-medium text-primary hover:underline"
            >
              Open this in the demo
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
