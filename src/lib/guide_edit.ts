import { create } from 'zustand'

import { GuideStep, GuideWithSteps } from '@/ipc/bindings.ts'

/**
 * Local guide ids start at this bound on the Rust side (see `LOCAL_GUIDE_ID_BASE` in
 * `src-tauri/src/guides.rs`). Such guides only exist on the user's disk: there is no
 * server version to restore them from.
 */
export const LOCAL_GUIDE_ID_BASE = 2_000_000_000

export type GuideDraft = {
  name: string
  steps: GuideStep[]
}

type GuideEditState = {
  editMode: boolean
  drafts: Record<number, GuideDraft>
  startEdit: (guide: GuideWithSteps) => void
  stopEdit: () => void
  resetDraft: (guide: GuideWithSteps) => void
  renameGuide: (guideId: number, name: string) => void
  updateStep: (guideId: number, stepIndex: number, patch: Partial<GuideStep>) => void
  addStep: (guideId: number, afterStepIndex: number) => number
  duplicateStep: (guideId: number, stepIndex: number) => number
  removeStep: (guideId: number, stepIndex: number) => void
  moveStep: (guideId: number, stepIndex: number, direction: -1 | 1) => void
}

export function isLocalGuide(guideId: number) {
  return guideId >= LOCAL_GUIDE_ID_BASE
}

export function createDraft(guide: GuideWithSteps): GuideDraft {
  return {
    name: guide.name,
    steps: guide.steps.map((step) => ({ ...step })),
  }
}

export function createEmptyStep(index: number): GuideStep {
  return {
    name: `Étape ${index + 1}`,
    map: null,
    pos_x: 0,
    pos_y: 0,
    web_text: '',
  }
}

export function isDraftDirty(draft: GuideDraft | undefined, guide: GuideWithSteps) {
  if (!draft) {
    return false
  }

  return JSON.stringify(draft) !== JSON.stringify(createDraft(guide))
}

/**
 * Counts the non empty lines of an edition draft, used to warn the user before leaving
 * the edition mode with unsaved work.
 */
export function countFilledSteps(draft: GuideDraft | undefined) {
  if (!draft) {
    return 0
  }

  return draft.steps.filter((step) => step.web_text.trim() !== '' || (step.name ?? '').trim() !== '').length
}

function withDraft(
  drafts: Record<number, GuideDraft>,
  guideId: number,
  updater: (draft: GuideDraft) => GuideDraft,
): Record<number, GuideDraft> {
  const draft = drafts[guideId]

  if (!draft) {
    return drafts
  }

  return { ...drafts, [guideId]: updater(draft) }
}

export const useGuideEdit = create<GuideEditState>()((set, get) => ({
  editMode: false,
  drafts: {},

  startEdit: (guide) => {
    const existingDraft = get().drafts[guide.id]

    set({
      editMode: true,
      drafts: existingDraft ? get().drafts : { ...get().drafts, [guide.id]: createDraft(guide) },
    })
  },

  // Leaving the edition mode always drops the drafts: they are only a working copy of
  // what has been saved on disk.
  stopEdit: () => set({ editMode: false, drafts: {} }),

  resetDraft: (guide) => set((state) => ({ drafts: { ...state.drafts, [guide.id]: createDraft(guide) } })),

  renameGuide: (guideId, name) =>
    set((state) => ({ drafts: withDraft(state.drafts, guideId, (draft) => ({ ...draft, name })) })),

  updateStep: (guideId, stepIndex, patch) =>
    set((state) => ({
      drafts: withDraft(state.drafts, guideId, (draft) => ({
        ...draft,
        steps: draft.steps.map((step, index) => (index === stepIndex ? { ...step, ...patch } : step)),
      })),
    })),

  addStep: (guideId, afterStepIndex) => {
    const draft = get().drafts[guideId]
    const insertAt = Math.min(afterStepIndex + 1, draft?.steps.length ?? 0)

    set((state) => ({
      drafts: withDraft(state.drafts, guideId, (current) => ({
        ...current,
        steps: [
          ...current.steps.slice(0, insertAt),
          createEmptyStep(current.steps.length),
          ...current.steps.slice(insertAt),
        ],
      })),
    }))

    return insertAt
  },

  duplicateStep: (guideId, stepIndex) => {
    const insertAt = stepIndex + 1

    set((state) => ({
      drafts: withDraft(state.drafts, guideId, (draft) => ({
        ...draft,
        steps: [
          ...draft.steps.slice(0, insertAt),
          // The duplicated step keeps the content but must not keep an identical name,
          // otherwise the two steps are indistinguishable in the summary.
          {
            ...draft.steps[stepIndex],
            name: `${draft.steps[stepIndex].name ?? `Étape ${stepIndex + 1}`} (copie)`,
          },
          ...draft.steps.slice(insertAt),
        ],
      })),
    }))

    return insertAt
  },

  // A guide always keeps at least one step: an empty guide cannot be opened.
  removeStep: (guideId, stepIndex) =>
    set((state) => ({
      drafts: withDraft(state.drafts, guideId, (draft) => {
        if (draft.steps.length <= 1) {
          return draft
        }

        return { ...draft, steps: draft.steps.filter((_, index) => index !== stepIndex) }
      }),
    })),

  moveStep: (guideId, stepIndex, direction) =>
    set((state) => ({
      drafts: withDraft(state.drafts, guideId, (draft) => {
        const targetIndex = stepIndex + direction

        if (targetIndex < 0 || targetIndex >= draft.steps.length) {
          return draft
        }

        const steps = [...draft.steps]
        const [moved] = steps.splice(stepIndex, 1)
        steps.splice(targetIndex, 0, moved)

        return { ...draft, steps }
      }),
    })),
}))
