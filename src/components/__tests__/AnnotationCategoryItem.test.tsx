import { fireEvent, render, screen } from '@testing-library/react'

import type { AnnotationStyle } from '../../types/layerStyles'
import type { Category } from '../../utils/annotationCategories'
import AnnotationCategoryItem from '../AnnotationCategoryItem'

const category: Category = {
  CodeValue: '49755003',
  CodeMeaning: 'Morphologically abnormal structure',
  CodingSchemeDesignator: 'SCT',
  types: [
    {
      CodeValue: '6574001',
      CodeMeaning: 'Necrosis',
      CodingSchemeDesignator: 'SCT',
      uids: ['roi-1', 'roi-2'],
    },
    {
      CodeValue: '108369006',
      CodeMeaning: 'Tumor',
      CodingSchemeDesignator: 'SCT',
      uids: ['roi-3'],
    },
  ],
}

const style: AnnotationStyle = {
  color: [255, 0, 0],
  opacity: 1,
  contourOnly: false,
}

function renderCategory(checkedAnnotationUids: Set<string>) {
  const onChange = vi.fn()
  const onStyleChange = vi.fn()
  render(
    <AnnotationCategoryItem
      category={category}
      onChange={onChange}
      onStyleChange={onStyleChange}
      defaultAnnotationStyles={{
        'roi-1': style,
        'roi-2': style,
        'roi-3': style,
      }}
      checkedAnnotationUids={checkedAnnotationUids}
    />,
  )
  return { onChange, onStyleChange }
}

describe('AnnotationCategoryItem', () => {
  it('shows the category with all its annotations next to each type', () => {
    renderCategory(new Set(['roi-1']))
    expect(
      screen.getByRole('button', {
        name: /^Morphologically abnormal structure category, 3 annotations/,
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /^Necrosis, 2 annotations/ }),
    ).toBeInTheDocument()
  })

  it('shows every annotation of a partly visible category', () => {
    const { onChange } = renderCategory(new Set(['roi-1']))
    fireEvent.click(
      screen.getByRole('button', { name: /category, 3 annotations/ }),
    )
    fireEvent.click(
      screen.getByRole('switch', {
        name: 'Show all Morphologically abnormal structure category',
      }),
    )
    expect(onChange).toHaveBeenCalledWith([
      { uid: 'roi-2', isVisible: true },
      { uid: 'roi-3', isVisible: true },
    ])
  })

  it('applies a category color to every type in it', () => {
    const { onStyleChange } = renderCategory(new Set())
    fireEvent.click(
      screen.getByRole('button', { name: /category, 3 annotations/ }),
    )
    const green = screen.getByRole('spinbutton', { name: 'Green value' })
    fireEvent.change(green, { target: { value: '128' } })
    fireEvent.keyDown(green, { key: 'Enter' })

    expect(onStyleChange).toHaveBeenCalledWith({
      uids: ['roi-1', 'roi-2', 'roi-3'],
      styleOptions: { ...style, color: [255, 128, 0] },
    })
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: 'Escape',
    })
    fireEvent.click(
      screen.getByRole('button', { name: /^Tumor, 1 annotations/ }),
    )
    expect(screen.getByRole('spinbutton', { name: 'Green value' })).toHaveValue(
      128,
    )
  })
})
