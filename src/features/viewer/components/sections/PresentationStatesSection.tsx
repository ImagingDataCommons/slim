import type React from 'react'

import {
  buildPresentationStateOptions,
  fromPresentationStateValue,
  type PresentationStateLike,
  toPresentationStateValue,
} from '../../../../components/SlideViewer/utils/selectOptions'
import { SlimCollapsibleSection } from '../../../../components/slim/SlimCollapsibleSection'
import { Button } from '../../../../components/ui/button'
import { Icon } from '../../../../components/ui/icon'
import { OptionSelect } from '../OptionSelect'

export interface PresentationStatesSectionProps {
  presentationStates: readonly PresentationStateLike[]
  selectedPresentationStateUID: string | undefined
  /** `undefined` selects the default (no presentation state) */
  onSelect: (sopInstanceUID: string | undefined) => void
  onReset: () => void
}

/** Picker for the Advanced Blending Presentation States of the slide. */
export function PresentationStatesSection({
  presentationStates,
  selectedPresentationStateUID,
  onSelect,
  onReset,
}: PresentationStatesSectionProps): React.ReactElement | null {
  if (presentationStates.length === 0) return null
  return (
    <SlimCollapsibleSection title="Presentation states" defaultOpen={false}>
      <div className="flex gap-1.5">
        <OptionSelect
          value={toPresentationStateValue(selectedPresentationStateUID)}
          options={buildPresentationStateOptions(presentationStates)}
          onValueChange={(value) => onSelect(fromPresentationStateValue(value))}
          triggerClassName="min-w-0 flex-1"
          aria-label="Presentation state"
        />
        <Button
          variant="outline"
          size="icon-sm"
          title="Reset"
          aria-label="Reset presentation state"
          onClick={onReset}
        >
          <Icon name="undo" size={18} />
        </Button>
      </div>
    </SlimCollapsibleSection>
  )
}
