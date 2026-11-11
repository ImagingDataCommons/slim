import type React from 'react'
import { useRef } from 'react'

import {
  type GoToField,
  type GoToFieldStatus,
  type GoToInput,
  type GoToRanges,
  MAX_GO_TO_MAGNIFICATION,
  MIN_GO_TO_MAGNIFICATION,
  validateGoToInput,
} from '../../features/viewer/utils/goTo'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import { Icon } from '../ui/icon'
import { ViewerModal } from './ViewerModal'

export interface GoToModalProps {
  isVisible: boolean
  input: GoToInput
  ranges: GoToRanges
  onInputChange: (field: GoToField, value: string) => void
  onOk: () => void
  onCancel: () => void
}

interface CoordinateFieldProps {
  id: string
  label: string
  placeholder: string
  value: string
  status: GoToFieldStatus
  onValueChange: (value: string) => void
  onSubmit: () => void
  inputRef?: React.Ref<HTMLInputElement>
}

function CoordinateField({
  id,
  label,
  placeholder,
  value,
  status,
  onValueChange,
  onSubmit,
  inputRef,
}: CoordinateFieldProps): React.ReactElement {
  const showInvalid = !status.isEmpty && !status.isValid

  return (
    <label
      htmlFor={id}
      className="flex flex-col gap-1.5 text-12 text-ink-muted"
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
          ref={inputRef}
          id={id}
          type="number"
          placeholder={placeholder}
          value={value}
          aria-invalid={showInvalid}
          onChange={(event) => onValueChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onSubmit()
          }}
          className="min-w-0 flex-1 border-0 bg-transparent font-mono text-12.5 text-ink outline-hidden placeholder:text-ink-fainter"
        />
        {!status.isEmpty && (
          <Icon
            name={status.isValid ? 'check_circle' : 'error'}
            size={18}
            className={status.isValid ? 'text-success' : 'text-destructive'}
          />
        )}
      </div>
    </label>
  )
}

/** Modal for navigating to a slide position and magnification. */
const GoToModal = ({
  isVisible,
  input,
  ranges,
  onInputChange,
  onOk,
  onCancel,
}: GoToModalProps): React.ReactElement => {
  const xInputRef = useRef<HTMLInputElement>(null)
  const { fields } = validateGoToInput(input, ranges)

  return (
    <ViewerModal
      isVisible={isVisible}
      onCancel={onCancel}
      icon="my_location"
      title="Go to position"
      subtitle="Center the viewport on slide coordinates"
      widthClassName="max-w-[440px]"
      bodyClassName="gap-3"
      onOpenAutoFocus={(event) => {
        event.preventDefault()
        xInputRef.current?.focus()
      }}
      footer={
        <>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onOk}>Go to position</Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <CoordinateField
          id="goto-x-coordinate"
          inputRef={xInputRef}
          label="X coordinate (mm)"
          placeholder={`${ranges.x[0]} – ${ranges.x[1]}`}
          value={input.x}
          status={fields.x}
          onValueChange={(value) => onInputChange('x', value)}
          onSubmit={onOk}
        />
        <CoordinateField
          id="goto-y-coordinate"
          label="Y coordinate (mm)"
          placeholder={`${ranges.y[0]} – ${ranges.y[1]}`}
          value={input.y}
          status={fields.y}
          onValueChange={(value) => onInputChange('y', value)}
          onSubmit={onOk}
        />
      </div>
      <CoordinateField
        id="goto-magnification"
        label="Magnification"
        placeholder={`${MIN_GO_TO_MAGNIFICATION} – ${MAX_GO_TO_MAGNIFICATION}`}
        value={input.magnification}
        status={fields.magnification}
        onValueChange={(value) => onInputChange('magnification', value)}
        onSubmit={onOk}
      />
    </ViewerModal>
  )
}

export default GoToModal
