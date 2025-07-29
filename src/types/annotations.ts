import * as dcmjs from 'dcmjs'

/**
 * Annotation settings configuration
 */
export interface AnnotationSettings {
  finding: dcmjs.sr.coding.CodeOptions
  findingCategory?: dcmjs.sr.coding.CodeOptions
  evaluations?: EvaluationSetting[]
  measurements?: MeasurementSetting[]
  geometryTypes?: string[]
  style?: {
    stroke: {
      color: number[]
      width: number
    }
    fill: {
      color: number[]
    }
    radius?: number
  }
}

/**
 * Evaluation setting for annotations
 */
export interface EvaluationSetting {
  name: dcmjs.sr.coding.CodeOptions
  values: dcmjs.sr.coding.CodeOptions[]
}

/**
 * Measurement setting for annotations
 */
export interface MeasurementSetting {
  name: dcmjs.sr.coding.CodeOptions
  unit: dcmjs.sr.coding.CodeOptions
}

/**
 * Annotation category and type information
 * Used by AnnotationCategoryList and related components
 */
export interface AnnotationCategoryAndType {
  uid: string
  type: Omit<Type, 'uids'>
  category: Omit<Category, 'types'>
}

/**
 * Type information for annotations
 */
export interface Type {
  CodeValue: string
  CodeMeaning: string
  CodingSchemeDesignator: string
  uids: string[]
}

/**
 * Category information for annotations
 */
export interface Category {
  CodeValue: string
  CodeMeaning: string
  CodingSchemeDesignator: string
  types: Type[]
}
