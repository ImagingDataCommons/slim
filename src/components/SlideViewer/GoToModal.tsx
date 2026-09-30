import type React from 'react'
import { useCallback, useState } from 'react'

import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  SlimDialogFooter,
  SlimDialogHeader,
} from '../ui/dialog'
import { Icon } from '../ui/icon'

interface GoToModalProps {
  isVisible: boolean
  onOk: () => void
  onCancel: () => void
  validXCoordinateRange: number[]
  validYCoordinateRange: number[]
  isSelectedXCoordinateValid: boolean
  isSelectedYCoordinateValid: boolean
  isSelectedMagnificationValid: boolean
  onXCoordinateSelection: (value: number | string | null) => void
  onYCoordinateSelection: (value: number | string | null) => void
  onMagnificationSelection: (value: number | string | null) => void
}

interface CoordinateFieldProps {
  id: string
  label: string
  placeholder: string
  isValid: boolean
  onValueChange: (value: number | null) => void
  onSubmit: () => void
}

function CoordinateField({
  id,
  label,
  placeholder,
  isValid,
  onValueChange,
  onSubmit,
}: CoordinateFieldProps): React.ReactElement {
  const [hasValue, setHasValue] = useState(false)
  const showInvalid = hasValue && !isValid

  return (
    <label
      htmlFor={id}
      className="flex flex-col gap-1.5 text-[12px] text-ink-muted"
    >
      {label}
      <div
        className={cn(
          'flex h-[38px] items-center gap-2 rounded-lg border px-2.5 focus-within:border-primary',
          showInvalid
            ? 'border-destructive/70 shadow-[0_0_0_3px_rgb(var(--destructive)/0.12)]'
            : 'border-line-input',
        )}
      >
        <input
          id={id}
          type="number"
          placeholder={placeholder}
          onChange={(event) => {
            const raw = event.target.value
            setHasValue(raw !== '')
            onValueChange(raw !== '' ? Number(raw) : null)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onSubmit()
          }}
          className="min-w-0 flex-1 border-0 bg-transparent font-mono text-[12.5px] text-ink outline-none placeholder:text-ink-fainter"
        />
        {hasValue && (
          <Icon
            name={isValid ? 'check_circle' : 'error'}
            size={18}
            className={isValid ? 'text-success' : 'text-destructive'}
          />
        )}
      </div>
    </label>
  )
}

/** Modal for navigating to a slide position and magnification. */
const GoToModal: React.FC<GoToModalProps> = ({
  isVisible,
  onOk,
  onCancel,
  validXCoordinateRange,
  validYCoordinateRange,
  isSelectedXCoordinateValid,
  isSelectedYCoordinateValid,
  isSelectedMagnificationValid,
  onXCoordinateSelection,
  onYCoordinateSelection,
  onMagnificationSelection,
}) => {
  const handleOpenChange = useCallback(
    (open: boolean): void => {
      if (!open) onCancel()
    },
    [onCancel],
  )

  return (
    <Dialog open={isVisible} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-[440px]"
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          document.getElementById('goto-x-coordinate')?.focus()
        }}
      >
        <SlimDialogHeader
          icon="my_location"
          title="Go to position"
          subtitle="Center the viewport on slide coordinates"
        />
        <div className="flex flex-col gap-3 overflow-y-auto px-5 pb-5 pt-[18px]">
          <div className="grid grid-cols-2 gap-3">
            <CoordinateField
              id="goto-x-coordinate"
              label="X coordinate (mm)"
              placeholder={`${validXCoordinateRange[0]} – ${validXCoordinateRange[1]}`}
              isValid={isSelectedXCoordinateValid}
              onValueChange={onXCoordinateSelection}
              onSubmit={onOk}
            />
            <CoordinateField
              id="goto-y-coordinate"
              label="Y coordinate (mm)"
              placeholder={`${validYCoordinateRange[0]} – ${validYCoordinateRange[1]}`}
              isValid={isSelectedYCoordinateValid}
              onValueChange={onYCoordinateSelection}
              onSubmit={onOk}
            />
          </div>
          <CoordinateField
            id="goto-magnification"
            label="Magnification"
            placeholder="0 – 40"
            isValid={isSelectedMagnificationValid}
            onValueChange={onMagnificationSelection}
            onSubmit={onOk}
          />
        </div>
        <SlimDialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onOk}>Go to position</Button>
        </SlimDialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default GoToModal
