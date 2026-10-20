import { planToolMode } from '../annotationToolModes'
import { INITIAL_VIEWER_INTERACTION } from '../viewerInteraction'

const idle = {
  ...INITIAL_VIEWER_INTERACTION,
}

describe('planToolMode', () => {
  it('plans select mode', () => {
    expect(
      planToolMode('select', idle, {
        isModifyInteractionActive: false,
        isTranslateInteractionActive: false,
      }),
    ).toEqual({
      deactivate: ['draw', 'modify', 'snap', 'translate'],
      activateSelect: true,
    })
  })

  it('plans draw start and stop', () => {
    expect(
      planToolMode('draw', idle, {
        isModifyInteractionActive: false,
        isTranslateInteractionActive: false,
      }),
    ).toEqual({
      deactivate: ['select', 'snap', 'translate', 'modify'],
      activateSelect: false,
    })
    expect(
      planToolMode(
        'draw',
        { ...idle, isRoiDrawingActive: true },
        {
          isModifyInteractionActive: false,
          isTranslateInteractionActive: false,
        },
      ),
    ).toEqual({ deactivate: ['draw'], activateSelect: true })
  })

  it('returns null when hide/show would be a no-op', () => {
    expect(
      planToolMode(
        'hide',
        { ...idle, areRoisHidden: true },
        {
          isModifyInteractionActive: false,
          isTranslateInteractionActive: false,
        },
      ),
    ).toBeNull()
    expect(
      planToolMode('show', idle, {
        isModifyInteractionActive: false,
        isTranslateInteractionActive: false,
      }),
    ).toBeNull()
  })

  it('cancels the active tool', () => {
    expect(
      planToolMode(
        'cancel',
        { ...idle, isRoiTranslationActive: true },
        {
          isModifyInteractionActive: false,
          isTranslateInteractionActive: true,
        },
      ),
    ).toEqual({ deactivate: ['translate'], activateSelect: true })
  })
})
