import { beforeEach, describe, expect, test } from 'vitest'

import { GuideWithSteps } from '@/ipc/bindings.ts'

import { createDraft, isDraftDirty, isLocalGuide, useGuideEdit } from './guide_edit.ts'

function makeGuide(overrides: Partial<GuideWithSteps> = {}): GuideWithSteps {
  return {
    id: 42,
    name: 'Mon guide',
    description: null,
    status: 'private',
    likes: 0,
    dislikes: 0,
    downloads: null,
    deleted_at: null,
    updated_at: '2026-01-01T00:00:00Z',
    lang: 'fr',
    order: 0,
    user: { id: 0, name: 'Test', is_admin: 0, is_certified: 0 },
    web_description: null,
    node_image: null,
    steps: [
      { name: 'Étape 1', map: null, pos_x: 1, pos_y: 2, web_text: 'Aller à [-12,8]' },
      { name: 'Étape 2', map: 'Astrub', pos_x: 3, pos_y: 4, web_text: 'Parler au PNJ' },
    ],
    ...overrides,
  }
}

beforeEach(() => {
  useGuideEdit.setState({ editMode: false, drafts: {} })
})

describe('createDraft', () => {
  test('copies the guide without sharing the step objects', () => {
    const guide = makeGuide()
    const draft = createDraft(guide)

    expect(draft.name).toBe(guide.name)
    expect(draft.steps).toEqual(guide.steps)
    expect(draft.steps[0]).not.toBe(guide.steps[0])
  })
})

describe('isDraftDirty', () => {
  test('is false right after the draft is created', () => {
    const guide = makeGuide()

    expect(isDraftDirty(createDraft(guide), guide)).toBe(false)
  })

  test('is false without a draft', () => {
    expect(isDraftDirty(undefined, makeGuide())).toBe(false)
  })

  test('detects a renamed guide and an edited step', () => {
    const guide = makeGuide()
    const draft = createDraft(guide)
    draft.name = 'Autre nom'

    expect(isDraftDirty(draft, guide)).toBe(true)

    const otherDraft = createDraft(guide)
    otherDraft.steps[1].web_text = 'Parler au PNJ [-12,8]'

    expect(isDraftDirty(otherDraft, guide)).toBe(true)
  })
})

describe('isLocalGuide', () => {
  test('separates guides created in the app from the downloaded ones', () => {
    expect(isLocalGuide(1074)).toBe(false)
    expect(isLocalGuide(2_000_000_000)).toBe(true)
  })
})

describe('useGuideEdit', () => {
  test('starts the edition mode with a draft of the guide', () => {
    const guide = makeGuide()
    useGuideEdit.getState().startEdit(guide)

    const state = useGuideEdit.getState()
    expect(state.editMode).toBe(true)
    expect(state.drafts[guide.id]).toEqual({ name: guide.name, steps: guide.steps })
  })

  test('keeps the draft when the edition mode is started twice', () => {
    const guide = makeGuide()
    useGuideEdit.getState().startEdit(guide)
    useGuideEdit.getState().renameGuide(guide.id, 'Brouillon')
    useGuideEdit.getState().startEdit(guide)

    expect(useGuideEdit.getState().drafts[guide.id].name).toBe('Brouillon')
  })

  test('stopEdit drops every draft', () => {
    const guide = makeGuide()
    useGuideEdit.getState().startEdit(guide)
    useGuideEdit.getState().stopEdit()

    const state = useGuideEdit.getState()
    expect(state.editMode).toBe(false)
    expect(state.drafts).toEqual({})
  })

  test('adds a step right after the current one and returns its index', () => {
    const guide = makeGuide()
    useGuideEdit.getState().startEdit(guide)

    const insertedAt = useGuideEdit.getState().addStep(guide.id, 0)
    const steps = useGuideEdit.getState().drafts[guide.id].steps

    expect(insertedAt).toBe(1)
    expect(steps).toHaveLength(3)
    expect(steps[1].web_text).toBe('')
    expect(steps[2].name).toBe('Étape 2')
  })

  test('duplicates a step with a distinguishable name', () => {
    const guide = makeGuide()
    useGuideEdit.getState().startEdit(guide)

    const insertedAt = useGuideEdit.getState().duplicateStep(guide.id, 0)
    const steps = useGuideEdit.getState().drafts[guide.id].steps

    expect(insertedAt).toBe(1)
    expect(steps[1].web_text).toBe('Aller à [-12,8]')
    expect(steps[1].name).toBe('Étape 1 (copie)')
  })

  test('never removes the last step of a guide', () => {
    const guide = makeGuide({
      steps: [{ name: 'Unique', map: null, pos_x: 0, pos_y: 0, web_text: '' }],
    })
    useGuideEdit.getState().startEdit(guide)
    useGuideEdit.getState().removeStep(guide.id, 0)

    expect(useGuideEdit.getState().drafts[guide.id].steps).toHaveLength(1)
  })

  test('moves a step up and down within the guide', () => {
    const guide = makeGuide()
    useGuideEdit.getState().startEdit(guide)

    useGuideEdit.getState().moveStep(guide.id, 1, -1)
    expect(useGuideEdit.getState().drafts[guide.id].steps.map((step) => step.name)).toEqual(['Étape 2', 'Étape 1'])

    useGuideEdit.getState().moveStep(guide.id, 0, 1)
    expect(useGuideEdit.getState().drafts[guide.id].steps.map((step) => step.name)).toEqual(['Étape 1', 'Étape 2'])
  })

  test('ignores a move outside of the step list', () => {
    const guide = makeGuide()
    useGuideEdit.getState().startEdit(guide)

    useGuideEdit.getState().moveStep(guide.id, 0, -1)
    useGuideEdit.getState().moveStep(guide.id, 1, 1)

    expect(useGuideEdit.getState().drafts[guide.id].steps.map((step) => step.name)).toEqual(['Étape 1', 'Étape 2'])
  })

  test('updates only the targeted step', () => {
    const guide = makeGuide()
    useGuideEdit.getState().startEdit(guide)
    useGuideEdit.getState().updateStep(guide.id, 1, { web_text: 'Nouveau contenu', pos_x: 12 })

    const steps = useGuideEdit.getState().drafts[guide.id].steps
    expect(steps[1]).toMatchObject({ web_text: 'Nouveau contenu', pos_x: 12, pos_y: 4, name: 'Étape 2' })
    expect(steps[0].web_text).toBe('Aller à [-12,8]')
  })

  test('resetDraft restores the saved version after a local save', () => {
    const guide = makeGuide()
    useGuideEdit.getState().startEdit(guide)
    useGuideEdit.getState().renameGuide(guide.id, 'Modifié')

    const savedGuide = { ...guide, name: 'Modifié' }
    useGuideEdit.getState().resetDraft(savedGuide)

    expect(isDraftDirty(useGuideEdit.getState().drafts[guide.id], savedGuide)).toBe(false)
  })
})
