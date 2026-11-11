import type { JSX } from 'react'

import InfoPage from '../components/InfoPage'
import type { ConfigProblem } from './configProblems'

export function ConfigProblemsPage({
  problems,
}: {
  problems: readonly ConfigProblem[]
}): JSX.Element {
  return (
    <InfoPage
      type="error"
      title="Slim is not configured correctly"
      message="Slim cannot start until the configuration is fixed."
    >
      <ul className="mt-2 flex w-full flex-col gap-2 text-left">
        {problems.map((problem) => (
          <li
            key={problem.message}
            className="rounded-lg border border-line bg-panel px-3.5 py-2.5"
          >
            <p className="text-13 font-semibold text-ink">{problem.message}</p>
            <p className="mt-0.5 text-12.5 text-ink-muted">{problem.hint}</p>
          </li>
        ))}
      </ul>
    </InfoPage>
  )
}
