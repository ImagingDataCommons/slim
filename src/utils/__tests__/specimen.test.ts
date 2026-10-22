import {
  buildSpecimenAttributes,
  getSpecimenStains,
  type PreparationStepItemLike,
  type SpecimenDescriptionLike,
} from '../specimen'

const code = (value: string, scheme: string, meaning: string) => ({
  CodeValue: value,
  CodingSchemeDesignator: scheme,
  CodeMeaning: meaning,
})

const codeItem = (
  name: ReturnType<typeof code>,
  value: ReturnType<typeof code>,
): PreparationStepItemLike => ({
  ValueType: 'CODE',
  ConceptNameCodeSequence: [name],
  ConceptCodeSequence: [value],
})

const textItem = (
  name: ReturnType<typeof code>,
  text: string,
): PreparationStepItemLike => ({
  ValueType: 'TEXT',
  ConceptNameCodeSequence: [name],
  TextValue: text,
})

const STAIN = code('424361007', 'SCT', 'Using substance')
const PROCESSING_TYPE = code('111701', 'DCM', 'Processing type')
const COLLECTION = code('17636008', 'SCT', 'Specimen collection')
const FIXATIVE = code('430864009', 'SCT', 'Tissue fixative')
const EMBEDDING = code('430863003', 'SCT', 'Embedding medium')
const PARENT = code('111705', 'DCM', 'Parent specimen identifier')

const description: SpecimenDescriptionLike = {
  SpecimenShortDescription: 'Core biopsy',
  PrimaryAnatomicStructureSequence: [
    {
      ...code('64033007', 'SCT', 'Kidney'),
      PrimaryAnatomicStructureModifierSequence: [
        code('24028007', 'SCT', 'Right'),
      ],
    },
    code('76752008', 'SCT', 'Breast'),
  ],
  SpecimenPreparationSequence: [
    {
      SpecimenPreparationStepContentItemSequence: [
        codeItem(PROCESSING_TYPE, code('17636008', 'SCT', 'Collection')),
        codeItem(COLLECTION, code('65801008', 'SCT', 'Excision')),
        textItem(PARENT, 'S-1'),
      ],
    },
    {
      SpecimenPreparationStepContentItemSequence: [
        codeItem(FIXATIVE, code('431510009', 'SCT', 'Formalin')),
        codeItem(EMBEDDING, code('311731000', 'SCT', 'Paraffin wax')),
      ],
    },
    {
      SpecimenPreparationStepContentItemSequence: [
        codeItem(STAIN, code('12710003', 'SCT', 'hematoxylin stain')),
        textItem(STAIN, 'eosin'),
      ],
    },
  ],
}

describe('buildSpecimenAttributes', () => {
  it('builds attributes in display order with stains', () => {
    expect(buildSpecimenAttributes(description, { showStain: true })).toEqual([
      { name: 'Description', value: 'Core biopsy' },
      { name: 'Anatomy', value: 'Kidney, Breast' },
      { name: 'Modifier', value: 'Right' },
      { name: 'Collection', value: 'Excision' },
      { name: 'Parent', value: 'S-1' },
      { name: 'Fixation', value: 'Formalin' },
      { name: 'Embedding', value: 'Paraffin wax' },
      { name: 'Staining', value: 'hematoxylin stain' },
      { name: 'Staining', value: 'eosin' },
    ])
  })

  it('hides stains when showStain is false', () => {
    const names = buildSpecimenAttributes(description, {
      showStain: false,
    }).map((attribute) => attribute.name)
    expect(names).not.toContain('Staining')
  })

  it('skips modifiers when no structure has a modifier sequence', () => {
    expect(
      buildSpecimenAttributes(
        {
          PrimaryAnatomicStructureSequence: [code('1', 'SCT', 'Liver')],
        },
        { showStain: true },
      ),
    ).toEqual([{ name: 'Anatomy', value: 'Liver' }])
  })

  it('requires both code value and scheme to match', () => {
    expect(
      buildSpecimenAttributes(
        {
          SpecimenPreparationSequence: [
            {
              SpecimenPreparationStepContentItemSequence: [
                codeItem(
                  code('424361007', 'SRT', 'Using substance'),
                  code('1', 'SCT', 'H&E'),
                ),
              ],
            },
          ],
        },
        { showStain: true },
      ),
    ).toEqual([])
  })

  it('tolerates missing sequences', () => {
    expect(buildSpecimenAttributes({}, { showStain: true })).toEqual([])
  })
})

describe('getSpecimenStains', () => {
  it('collects coded and text stains without duplicates', () => {
    expect(getSpecimenStains([description, description])).toEqual([
      'hematoxylin stain',
      'eosin',
    ])
  })

  it('returns an empty list without descriptions', () => {
    expect(getSpecimenStains(undefined)).toEqual([])
    expect(getSpecimenStains([{}])).toEqual([])
  })
})
