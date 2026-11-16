import { Trans, useLingui } from '@lingui/react/macro'
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { GuideFrame } from '@/components/guide_frame.tsx'
import { Position } from '@/components/position.tsx'
import { StepProgress } from '@/components/step_progress/step_progress.tsx'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert_dialog.tsx'
import { useGuide } from '@/hooks/use_guide.ts'
import { useScrollToTop } from '@/hooks/use_scroll_to_top.ts'
import { useStepNoteReminder } from '@/hooks/use_step_note_reminder.tsx'
import { onCopyCurrentGuideStep } from '@/ipc/guides.ts'
import { isDraftDirty, useGuideEdit } from '@/lib/guide_edit.ts'
import { getProfile } from '@/lib/profile.ts'
import { queueProgressSync } from '@/lib/sync_progress_queue.ts'
import { cn } from '@/lib/utils.ts'
import { useDuplicateGuide } from '@/mutations/duplicate_guide.mutation.ts'
import { useSetConf } from '@/mutations/set_conf.mutation.ts'
import { confQuery } from '@/queries/conf.query.ts'
import { GuideActionsDropdown } from '@/routes/_app/guides/-$id/guide_actions_dropdown.tsx'

import { GuideEditPanel } from './guide_edit_panel.tsx'
import { GuideNotesDialog, GuideNotesMenuTrigger } from './guide_notes_dialog.tsx'
import { ReportDialog, ReportDialogTrigger } from './report_dialog.tsx'
import { StepNoteDialog } from './step_note_dialog.tsx'
import { SummaryDialog, SummaryDialogTrigger } from './summary_dialog.tsx'

const useOnCopyStep = (cb: () => void) => {
  useEffect(() => {
    const unlisten = onCopyCurrentGuideStep().on(cb)

    return () => {
      unlisten.then((cb) => cb())
    }
  }, [cb])
}

export function GuidePage({ id, stepIndex: index }: { id: number; stepIndex: number }) {
  const { t } = useLingui()
  const guide = useGuide(id)
  const editMode = useGuideEdit((state) => state.editMode)
  const draft = useGuideEdit((state) => state.drafts[id])
  const startEdit = useGuideEdit((state) => state.startEdit)
  const stopEdit = useGuideEdit((state) => state.stopEdit)
  const duplicateGuide = useDuplicateGuide()
  // In the edition mode the step list and the current step come from the draft, which
  // may already contain more steps than the version saved on disk.
  const editedSteps = editMode && draft ? draft.steps : guide.steps
  const step = editedSteps[index] ?? guide.steps[index]
  const stepMax = editedSteps.length - 1
  const scrollableRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()
  const conf = useSuspenseQuery(confQuery)
  const setConf = useSetConf()
  const navigate = useNavigate()
  const [noteOpen, setNoteOpen] = useState(false)
  const [noteStepIndex, setNoteStepIndex] = useState(index)
  const [guideNotesOpen, setGuideNotesOpen] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [confirmLeaveEditOpen, setConfirmLeaveEditOpen] = useState(false)

  const showSummary = guide.game_type !== 'wakfu'
  const showReport = guide.status === 'gp' || guide.status === 'certified'

  useScrollToTop(scrollableRef, [step])
  useStepNoteReminder(guide.id, index)

  const changeStep = async (nextStep: number) => {
    // Read the store directly: a step added or removed a moment ago is not in the
    // values captured by this render yet, and clamping on them would refuse the
    // navigation to the new step.
    const storeState = useGuideEdit.getState()
    const draftStepsCount = storeState.drafts[guide.id]?.steps.length
    const stepsCount = storeState.editMode && draftStepsCount ? draftStepsCount : guide.steps.length
    const clampedStep = nextStep < 0 ? 0 : nextStep >= stepsCount ? stepsCount - 1 : nextStep
    const updatedAt = new Date().toISOString()

    const newConf = {
      ...conf.data,
      profiles: conf.data.profiles.map((p) => {
        if (p.id === conf.data.profileInUse) {
          const existingProgress = p.progresses.find((progress) => progress.id === guide.id)

          return {
            ...p,
            progresses: existingProgress
              ? p.progresses.map((progress) => {
                  if (progress.id === guide.id) {
                    return {
                      ...progress,
                      currentStep: clampedStep,
                      updatedAt,
                      syncPending: true,
                    }
                  }

                  return progress
                })
              : [
                  ...p.progresses,
                  {
                    id: guide.id,
                    currentStep: clampedStep,
                    steps: {},
                    updatedAt,
                    syncPending: true,
                  },
                ],
          }
        }

        return p
      }),
    }

    setConf.mutate(newConf)

    const profile = getProfile(newConf)
    const progress = profile.progresses.find((p) => p.id === guide.id)
    queueProgressSync(profile.server_id, guide.id, clampedStep, progress?.steps ?? {}, queryClient, guide.name)

    await navigate({
      to: '/guides/$id',
      params: {
        id: guide.id,
      },
      search: {
        step: nextStep,
      },
    })
  }

  const onClickPrevious = async (): Promise<boolean> => {
    if (index === 0) {
      return false
    }

    await changeStep(index - 1)

    return true
  }

  const onClickNext = async (): Promise<boolean> => {
    if (index === stepMax) {
      return false
    }

    await changeStep(index + 1)

    return true
  }

  const onChangeStep = async (stepIndex: number): Promise<boolean> => {
    if (index === stepIndex) {
      return false
    }

    await changeStep(stepIndex)

    return true
  }

  const isDraftDirtyNow = editMode && isDraftDirty(draft, guide)

  const handleToggleEditMode = () => {
    if (editMode) {
      if (isDraftDirtyNow) {
        setConfirmLeaveEditOpen(true)

        return
      }

      stopEdit()

      return
    }

    startEdit(guide)
  }

  const handleDuplicateGuide = () => {
    duplicateGuide.mutate(
      { guideId: guide.id },
      {
        onSuccess: async (copy) => {
          toast.success(t`Guide dupliqué`)
          await navigate({
            to: '/guides/$id',
            params: { id: copy.id },
            search: { step: 0 },
          })
        },
        onError: () => {
          toast.error(t`Impossible de dupliquer le guide`)
        },
      },
    )
  }

  const handleOpenNote = () => {
    setNoteStepIndex(index)
    setNoteOpen(true)
  }

  const handleEditStep = (step: number) => {
    setGuideNotesOpen(false)
    setNoteStepIndex(step)
    setNoteOpen(true)
  }

  const handleGoToStep = (step: number) => {
    setGuideNotesOpen(false)
    onChangeStep(step)
  }

  useOnCopyStep(() => {
    toast
      .promise(writeText((index + 1).toString()), {
        success: t`Le numéro de l'étape (${index + 1}) a été copié dans le presse-papiers.`,
        error: t`Erreur lors de la copie du numéro de l'étape (${index + 1}).`,
        loading: t`Copie du numéro de l'étape (${index + 1})...`,
      })
      .unwrap()
  })

  // Use theme-aware background color with opacity via CSS color-mix
  const bgColor = `color-mix(in srgb, var(--color-surface-page) ${conf.data.opacity * 100}%, transparent)`
  const isSmallGuide = conf.data.guideDisplay === 'Small'

  return (
    <div
      className="scroller mt-[40px] flex h-[calc(100vh-var(--spacing-titlebar)-40px-40px)] flex-col overflow-x-hidden overflow-y-scroll pb-2"
      ref={scrollableRef}
      style={{ backgroundColor: bgColor }}
    >
      <header
        className={cn('fixed inset-x-0 top-[70px] z-10', !isSmallGuide && 'sm:top-[66px]')}
        style={{ backgroundColor: bgColor }}
      >
        <div className="flex h-10 items-center p-1">
          {step && (
            <>
              {/* Left Side - Fixed width to maintain center balance */}
              <div className="flex w-16 shrink-0 items-center justify-start pl-1">
                {step.map !== null && step.map.toLowerCase() !== 'nomap' && (
                  <Position pos_x={step.pos_x} pos_y={step.pos_y} />
                )}
              </div>

              {/* Center - Progress Bar */}
              <div className="flex flex-1 items-center justify-center">
                <StepProgress
                  currentIndex={index}
                  key={`${guide.id}-${index}`}
                  maxIndex={stepMax}
                  onChangeStep={changeStep}
                  onNext={onClickNext}
                  onPrevious={onClickPrevious}
                />
              </div>

              {/* Right Side - Fixed width to maintain center balance */}
              <div className="hidden w-20 shrink-0 items-center justify-end pr-1 xs:flex sm:w-24">
                <GuideNotesMenuTrigger
                  guideId={guide.id}
                  onOpenGuideNotes={() => setGuideNotesOpen(true)}
                  onOpenNote={handleOpenNote}
                  stepIndex={index}
                />
                {showSummary && <SummaryDialogTrigger onClick={() => setSummaryOpen(true)} />}
                {showReport && <ReportDialogTrigger onClick={() => setReportOpen(true)} />}
              </div>
              <div className="flex w-fit shrink-0 items-center justify-end pr-1 xs:hidden">
                <GuideActionsDropdown
                  guideId={guide.id}
                  isEditMode={editMode}
                  isGuideEditPending={duplicateGuide.isPending}
                  onDuplicateGuide={handleDuplicateGuide}
                  onOpenGuideNotes={() => setGuideNotesOpen(true)}
                  onOpenNote={handleOpenNote}
                  onOpenReport={() => setReportOpen(true)}
                  onOpenSummary={() => setSummaryOpen(true)}
                  onToggleEditMode={handleToggleEditMode}
                  showReport={showReport}
                  showSummary={showSummary}
                  stepIndex={index}
                />
              </div>
            </>
          )}
        </div>
      </header>
      <StepNoteDialog guideId={guide.id} onOpenChange={setNoteOpen} open={noteOpen} stepIndex={noteStepIndex} />
      <GuideNotesDialog
        guideId={guide.id}
        onEditStep={handleEditStep}
        onGoToStep={handleGoToStep}
        onOpenChange={setGuideNotesOpen}
        open={guideNotesOpen}
      />
      {showSummary && (
        <SummaryDialog
          guideId={guide.id}
          onChangeStep={onChangeStep}
          onOpenChange={setSummaryOpen}
          open={summaryOpen}
        />
      )}
      {showReport && (
        <ReportDialog guideId={guide.id} onOpenChange={setReportOpen} open={reportOpen} stepIndex={index} />
      )}
      {editMode ? (
        <GuideEditPanel guide={guide} onChangeStep={onChangeStep} stepIndex={index} />
      ) : (
        step && (
          <GuideFrame
            className={cn(
              'guide px-2 pt-2 leading-5',
              !isSmallGuide && 'xs:px-3 xs:pt-3 sm:px-4 sm:pt-4',
              conf.data.fontSize === 'ExtraSmall' && 'text-xs',
              conf.data.fontSize === 'Small' && 'text-sm leading-4',
              conf.data.fontSize === 'Large' && 'text-md leading-5',
              conf.data.fontSize === 'ExtraLarge' && 'text-lg leading-6',
            )}
            guideId={guide.id}
            html={step.web_text}
            stepIndex={index}
          />
        )
      )}

      <AlertDialog onOpenChange={setConfirmLeaveEditOpen} open={confirmLeaveEditOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <Trans>Abandonner les modifications non enregistrées ?</Trans>
            </AlertDialogTitle>
            <AlertDialogDescription>
              <Trans>
                Le guide n'a pas été enregistré. Quitter le mode édition maintenant perdra vos modifications.
              </Trans>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <Trans>Continuer l'édition</Trans>
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmLeaveEditOpen(false)
                stopEdit()
              }}
            >
              <Trans>Quitter sans enregistrer</Trans>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
