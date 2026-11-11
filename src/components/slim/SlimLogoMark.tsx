import type * as React from 'react'

/**
 * Microscope glyph from the favicon (public/favicon.svg), drawn in
 * `currentColor` on a 32-unit grid so it fills its tile edge to edge.
 */
export function SlimLogoMark({
  className,
}: {
  className?: string
}): React.ReactElement {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <g transform="translate(-0.8 0)">
        <g fill="currentColor">
          <rect x="11.6" y="4.6" width="4.8" height="2.6" rx="0.9" />
          <rect x="10.4" y="6.4" width="7.2" height="12.4" rx="1.8" />
          <rect x="12.2" y="18.2" width="3.6" height="2.4" rx="0.8" />
          <rect x="8.6" y="21.8" width="11" height="1.9" rx="0.6" />
          <path d="M7.4 25.2H23.6c1.9 0 3.4 0.9 3.8 2.3H7.4a1.15 1.15 0 0 1 0-2.3z" />
        </g>
        <path
          d="M17.4 11.6H19.6A6.9 6.9 0 0 1 21.4 25.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.2"
        />
      </g>
    </svg>
  )
}
