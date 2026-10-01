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

interface CodeRef {
  value: string
  scheme: string
}

/** TID 8001 "Specimen Preparation" concept names */
export const SPECIMEN_STEP_CODES = {
  PROCESSING_TYPE: { value: '111701', scheme: 'DCM' },
  PARENT_SPECIMEN_IDENTIFIER: { value: '111705', scheme: 'DCM' },
  COLLECTION_METHOD: { value: '17636008', scheme: 'SCT' },
  FIXATIVE: { value: '430864009', scheme: 'SCT' },
  EMBEDDING_MEDIUM: { value: '430863003', scheme: 'SCT' },
  STAIN: { value: '424361007', scheme: 'SCT' },
} as const

function matchesCode(code: CodeLike | undefined, ref: CodeRef): boolean {
  return (
    code !== undefined &&
    code.CodeValue === ref.value &&
    code.CodingSchemeDesignator === ref.scheme
  )
}

const CODE_STEP_LABELS: Array<{ code: CodeRef; name: string }> = [
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
