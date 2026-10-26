import { fireEvent, render, screen } from '@testing-library/react'

import { ConfigProblemsPage } from '../../app/ConfigProblemsPage'
import CustomErrorBoundary from '../CustomErrorBoundary'

function Crash(): never {
  throw new Error('Server "main" is unreachable')
}

describe('CustomErrorBoundary', () => {
  it('shows the error message with reload and details actions', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    render(
      <CustomErrorBoundary context="App">
        <Crash />
      </CustomErrorBoundary>,
    )
    expect(
      screen.getByRole('heading', { name: 'Something went wrong' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Server "main" is unreachable')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Reload page/ }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Show details' }))
    expect(screen.getByText('Stack trace')).toBeInTheDocument()
  })
})

describe('ConfigProblemsPage', () => {
  it('lists each problem with its hint', () => {
    render(
      <ConfigProblemsPage
        problems={[
          {
            message: 'The DICOMweb server "preview" has no URL.',
            hint: 'Set SLIM_PREVIEW_DICOMWEB_URL in .env.',
          },
        ]}
      />,
    )
    expect(
      screen.getByRole('heading', { name: 'Slim is not configured correctly' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('The DICOMweb server "preview" has no URL.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Set SLIM_PREVIEW_DICOMWEB_URL in .env.'),
    ).toBeInTheDocument()
  })
})
