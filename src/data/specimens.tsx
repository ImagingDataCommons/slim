import * as dcmjs from 'dcmjs'

export const SpecimenPreparationTypes: {
  [key: string]: dcmjs.sr.coding.CodedConcept
} = {
  COLLECTION: new dcmjs.sr.coding.CodedConcept({
    value: '17636008',
    schemeDesignator: 'SCT',
    meaning: 'Specimen collection'
  }),
  SAMPLING: new dcmjs.sr.coding.CodedConcept({
    value: '433465004',
    schemeDesignator: 'SCT',
    meaning: 'Sampling of tissue specimen'
  }),
  STAINING: new dcmjs.sr.coding.CodedConcept({
    value: '127790008',
    schemeDesignator: 'SCT',
    meaning: 'Specimen staining'
  }),
  PROCESSING: new dcmjs.sr.coding.CodedConcept({
    value: '9265001',
    schemeDesignator: 'SCT',
    meaning: 'Specimen processing'
  })
}

export const SpecimenPreparationAdditives: {
  [key: string]: dcmjs.sr.coding.CodedConcept
} = {
  FIXATIVE: new dcmjs.sr.coding.CodedConcept({
    value: '430864009',
    schemeDesignator: 'SCT',
    meaning: 'Tissue fixative'
  }),
  EMBEDDING_MEDIUM: new dcmjs.sr.coding.CodedConcept({
    value: '430863003',
    schemeDesignator: 'SCT',
    meaning: 'Embedding medium'
  })
}

export const SpecimenPreparationStepItems: {
  [key: string]: dcmjs.sr.coding.CodedConcept
} = {
  SPECIMEN_IDENTIFIER: new dcmjs.sr.coding.CodedConcept({
    value: '121041',
    schemeDesignator: 'DCM',
    meaning: 'Specimen identifier'
  }),
  PARENT_SPECIMEN_IDENTIFIER: new dcmjs.sr.coding.CodedConcept({
    value: '111705',
    schemeDesignator: 'DCM',
    meaning: 'Parent specimen identifier'
  }),
  PROCESSING_TYPE: new dcmjs.sr.coding.CodedConcept({
    value: '111701',
    schemeDesignator: 'DCM',
    meaning: 'Processing type'
  }),
  DATETIME_OF_PROCESSING: new dcmjs.sr.coding.CodedConcept({
    value: '111702',
    schemeDesignator: 'DCM',
    meaning: 'Datetime of processing'
  }),
  PROCESSING_STEP_DESCRIPTION: new dcmjs.sr.coding.CodedConcept({
    value: '111703',
    schemeDesignator: 'DCM',
    meaning: 'Processing step description'
  }),
  COLLECTION_METHOD: new dcmjs.sr.coding.CodedConcept({
    value: '17636008',
    schemeDesignator: 'SCT',
    meaning: 'Specimen collection'
  }),
  SAMPLING_METHOD: new dcmjs.sr.coding.CodedConcept({
    value: '111704',
    schemeDesignator: 'DCM',
    meaning: 'Sampling method'
  }),
  STAIN: new dcmjs.sr.coding.CodedConcept({
    value: '424361007',
    schemeDesignator: 'SCT',
    meaning: 'Using substance'
  }),
  ...SpecimenPreparationAdditives
}
