import type * as dcmjs from 'dcmjs'
import type React from 'react'

import type {
  Evaluation,
  EvaluationOptions,
} from '../../../../components/SlideViewer/types'
import {
  buildCodedConceptOptions,
  buildGeometryTypeOptions,
  findOptionItem,
  NO_EVALUATION_VALUE,
  selectedConceptValue,
} from '../../../../components/SlideViewer/utils/selectOptions'
import { Checkbox } from '../../../../components/ui/checkbox'
import { codedConceptKey } from '../../../../utils/dicom/codedConcept'
import { OptionSelect } from '../OptionSelect'

type CodedConcept = dcmjs.sr.coding.CodedConcept

export interface AnnotationConfigurationFieldsProps {
  findings: readonly CodedConcept[]
  selectedFinding: CodedConcept | undefined
  /** Evaluations offered for the selected finding */
  evaluationOptions: readonly EvaluationOptions[]
  selectedEvaluations: readonly Evaluation[]
  /** Geometry types allowed for the selected finding */
  geometryTypes: readonly string[]
  selectedGeometryType: string | undefined
  isMeasurementActive: boolean
  onFindingChange: (finding: CodedConcept) => void
  onEvaluationChange: (name: CodedConcept, value: CodedConcept) => void
  onEvaluationClear: (name: CodedConcept) => void
  onGeometryTypeChange: (geometryType: string) => void
  onMeasurementChange: (isActive: boolean) => void
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}): React.ReactElement {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-12 text-ink-muted">{label}</span>
      {children}
    </div>
  )
}

function EvaluationField({
  evaluation,
  index,
  selectedEvaluations,
  onEvaluationChange,
  onEvaluationClear,
}: {
  evaluation: EvaluationOptions
  index: number
  selectedEvaluations: readonly Evaluation[]
  onEvaluationChange: (name: CodedConcept, value: CodedConcept) => void
  onEvaluationClear: (name: CodedConcept) => void
}): React.ReactElement {
  const options = buildCodedConceptOptions(
    evaluation.values,
    `evaluation-${index}`,
  )
  const selectedValue = selectedEvaluations.find(
    (item) => codedConceptKey(item.name) === codedConceptKey(evaluation.name),
  )?.value
  return (
    <Field label={evaluation.name.CodeMeaning}>
      <OptionSelect
        value={selectedConceptValue(options, selectedValue)}
        options={options}
        leadingOption={{ value: NO_EVALUATION_VALUE, label: 'None' }}
        placeholder="Select…"
        onValueChange={(value) => {
          if (value === NO_EVALUATION_VALUE) {
            onEvaluationClear(evaluation.name)
            return
          }
          const code = findOptionItem(options, value)
          if (code !== undefined) onEvaluationChange(evaluation.name, code)
        }}
      />
    </Field>
  )
}

/** Finding, evaluations, geometry and measurement choices before drawing. */
export function AnnotationConfigurationFields({
  findings,
  selectedFinding,
  evaluationOptions,
  selectedEvaluations,
  geometryTypes,
  selectedGeometryType,
  isMeasurementActive,
  onFindingChange,
  onEvaluationChange,
  onEvaluationClear,
  onGeometryTypeChange,
  onMeasurementChange,
}: AnnotationConfigurationFieldsProps): React.ReactElement {
  const findingOptions = buildCodedConceptOptions(findings, 'finding')
  const findingKey =
    selectedFinding !== undefined ? codedConceptKey(selectedFinding) : ''
  return (
    <>
      <Field label="Finding">
        <OptionSelect
          value={selectedConceptValue(findingOptions, selectedFinding)}
          options={findingOptions}
          placeholder="Select finding"
          onValueChange={(value) => {
            const finding = findOptionItem(findingOptions, value)
            if (finding !== undefined) onFindingChange(finding)
          }}
        />
      </Field>
      {selectedFinding !== undefined && (
        <>
          {evaluationOptions.map((evaluation, index) => (
            <EvaluationField
              key={`eval-${findingKey}-${codedConceptKey(evaluation.name)}`}
              evaluation={evaluation}
              index={index}
              selectedEvaluations={selectedEvaluations}
              onEvaluationChange={onEvaluationChange}
              onEvaluationClear={onEvaluationClear}
            />
          ))}
          <Field label="ROI geometry">
            <OptionSelect
              value={selectedGeometryType ?? ''}
              options={buildGeometryTypeOptions(geometryTypes)}
              placeholder="Select geometry type"
              onValueChange={onGeometryTypeChange}
            />
          </Field>
          <label
            htmlFor="measure-checkbox"
            className="flex cursor-pointer items-center gap-2 pt-1 text-13 text-ink"
          >
            <Checkbox
              id="measure-checkbox"
              checked={isMeasurementActive}
              onCheckedChange={(checked) =>
                onMeasurementChange(checked === true)
              }
            />
            Measure length or area while drawing
          </label>
        </>
      )}
    </>
  )
}
