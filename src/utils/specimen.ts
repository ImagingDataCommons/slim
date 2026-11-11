import { type CodedConceptLike, isSameCodedConcept } from './dicom/codedConcept'

interface CodeLike {
  CodeValue: string
  CodingSchemeDesignator: string
  CodeMeaning: string
}

export interface PreparationStepItemLike {
  ValueType: string
  ConceptNameCodeSequence: CodeLike[]
  ConceptCodeSequence?: CodeLike[]
  TextValue?: string
}

export interface SpecimenPreparationLike {
  SpecimenPreparationStepContentItemSequence?: PreparationStepItemLike[]
}

export interface SpecimenDescriptionLike {
  SpecimenShortDescription?: string
  PrimaryAnatomicStructureSequence?: Array<
    CodeLike & { PrimaryAnatomicStructureModifierSequence?: CodeLike[] }
  >
  SpecimenPreparationSequence?: SpecimenPreparationLike[]
}

export interface SpecimenAttribute {
  name: string
  value: string
}

/** TID 8001 "Specimen Preparation" concept names */
export const SPECIMEN_STEP_CODES = {
  PROCESSING_TYPE: {
    CodeValue: '111701',
    CodingSchemeDesignator: 'DCM',
  },
  PARENT_SPECIMEN_IDENTIFIER: {
    CodeValue: '111705',
    CodingSchemeDesignator: 'DCM',
  },
  COLLECTION_METHOD: {
    CodeValue: '17636008',
    CodingSchemeDesignator: 'SCT',
  },
  FIXATIVE: {
    CodeValue: '430864009',
    CodingSchemeDesignator: 'SCT',
  },
  EMBEDDING_MEDIUM: {
    CodeValue: '430863003',
    CodingSchemeDesignator: 'SCT',
  },
  STAIN: {
    CodeValue: '424361007',
    CodingSchemeDesignator: 'SCT',
  },
} as const satisfies Record<string, CodedConceptLike>

function matchesCode(
  code: CodeLike | undefined,
  ref: CodedConceptLike,
): boolean {
  return code !== undefined && isSameCodedConcept(code, ref)
}

const CODE_STEP_LABELS: Array<{ code: CodedConceptLike; name: string }> = [
  { code: SPECIMEN_STEP_CODES.COLLECTION_METHOD, name: 'Collection' },
  { code: SPECIMEN_STEP_CODES.FIXATIVE, name: 'Fixation' },
  { code: SPECIMEN_STEP_CODES.EMBEDDING_MEDIUM, name: 'Embedding' },
]

function getStepItems(
  description: SpecimenDescriptionLike,
): PreparationStepItemLike[] {
  return (description.SpecimenPreparationSequence ?? []).flatMap(
    (step) => step.SpecimenPreparationStepContentItemSequence ?? [],
  )
}

/** Stain value of a preparation step item, if the item describes a stain */
function getStainValue(item: PreparationStepItemLike): string | undefined {
  if (
    !matchesCode(item.ConceptNameCodeSequence?.[0], SPECIMEN_STEP_CODES.STAIN)
  )
    return undefined
  if (item.ValueType === 'CODE')
    return item.ConceptCodeSequence?.[0]?.CodeMeaning
  if (item.ValueType === 'TEXT') return item.TextValue
  return undefined
}

function getPreparationStepAttribute(
  item: PreparationStepItemLike,
  showStain: boolean,
): SpecimenAttribute | undefined {
  const name = item.ConceptNameCodeSequence?.[0]
  if (item.ValueType === 'CODE') {
    const value = item.ConceptCodeSequence?.[0]?.CodeMeaning
    if (value === undefined) return undefined
    if (matchesCode(name, SPECIMEN_STEP_CODES.PROCESSING_TYPE)) return undefined
    const label = CODE_STEP_LABELS.find((entry) =>
      matchesCode(name, entry.code),
    )
    if (label !== undefined) return { name: label.name, value }
    if (showStain && matchesCode(name, SPECIMEN_STEP_CODES.STAIN)) {
      return { name: 'Staining', value }
    }
    return undefined
  }
  if (item.ValueType === 'TEXT') {
    const value = item.TextValue
    if (value === undefined) return undefined
    if (matchesCode(name, SPECIMEN_STEP_CODES.STAIN)) {
      return showStain ? { name: 'Staining', value } : undefined
    }
    if (matchesCode(name, SPECIMEN_STEP_CODES.PARENT_SPECIMEN_IDENTIFIER)) {
      return { name: 'Parent', value }
    }
  }
  return undefined
}

/** Description, anatomy, modifiers and preparation steps of one specimen */
export function buildSpecimenAttributes(
  description: SpecimenDescriptionLike,
  { showStain }: { showStain: boolean },
): SpecimenAttribute[] {
  const attributes: SpecimenAttribute[] = []

  if (description.SpecimenShortDescription !== undefined) {
    attributes.push({
      name: 'Description',
      value: description.SpecimenShortDescription,
    })
  }

  const structures = description.PrimaryAnatomicStructureSequence ?? []
  if (structures.length > 0) {
    attributes.push({
      name: 'Anatomy',
      value: structures.map((item) => item.CodeMeaning).join(', '),
    })
    const modifiers = structures.find(
      (item) => item.PrimaryAnatomicStructureModifierSequence !== undefined,
    )?.PrimaryAnatomicStructureModifierSequence
    if (modifiers !== undefined && modifiers.length > 0) {
      attributes.push({
        name: 'Modifier',
        value: modifiers.map((item) => item.CodeMeaning).join(', '),
      })
    }
  }

  for (const item of getStepItems(description)) {
    const attribute = getPreparationStepAttribute(item, showStain)
    if (attribute !== undefined) attributes.push(attribute)
  }

  return attributes
}

/** Unique stains (coded or free text) across all specimen descriptions */
export function getSpecimenStains(
  specimenDescriptions: SpecimenDescriptionLike[] | undefined,
): string[] {
  const stains: string[] = []
  for (const description of specimenDescriptions ?? []) {
    for (const item of getStepItems(description)) {
      const stain = getStainValue(item)?.trim()
      if (stain !== undefined && stain !== '' && !stains.includes(stain)) {
        stains.push(stain)
      }
    }
  }
  return stains
}
