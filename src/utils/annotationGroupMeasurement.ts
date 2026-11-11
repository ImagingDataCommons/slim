/** skipcq: JS-C1003 */
import * as dcmjs from 'dcmjs'

import type { MeasurementOption } from './annotationGroup'

/** Coded concept the viewer expects for "color by measurement" */
export function measurementOptionToConcept(
  option: MeasurementOption,
): dcmjs.sr.coding.CodedConcept {
  return new dcmjs.sr.coding.CodedConcept({
    value: option.value,
    schemeDesignator: option.schemeDesignator,
    meaning: option.meaning,
  })
}
