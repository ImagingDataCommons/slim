import type React from 'react'

import AnnotationCategoryList from '../../../../components/AnnotationCategoryList'
import { SlimCollapsibleSection } from '../../../../components/slim/SlimCollapsibleSection'

export type AnnotationCategoriesSectionProps = React.ComponentProps<
  typeof AnnotationCategoryList
>

/** ROIs grouped by finding category and type. */
export function AnnotationCategoriesSection(
  props: AnnotationCategoriesSectionProps,
): React.ReactElement | null {
  if (props.annotations.length === 0) return null
  return (
    <SlimCollapsibleSection
      title="Annotation categories"
      defaultOpen={false}
      padding="indent"
    >
      <AnnotationCategoryList {...props} />
    </SlimCollapsibleSection>
  )
}
