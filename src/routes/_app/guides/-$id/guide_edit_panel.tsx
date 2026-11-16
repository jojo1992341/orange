import { Trans, useLingui } from '@lingui/react/macro'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  PlusIcon,
  RotateCcwIcon,
  SaveIcon,
  TrashIcon,
  Undo2Icon,
  XIcon,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { GuideFrame } from '@/components/guide_frame.tsx'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert_dialog.tsx'
import { Badge } from '@/components/ui/badge.tsx'
import { Button } from '@/components/ui/button.tsx'
import { Input } from '@/components/ui/input.tsx'
import { Label } from '@/components/ui/label.tsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.tsx'
import { Textarea } from '@/components/ui/textarea.tsx'
import { GuideStep, GuideWithSteps } from '@/ipc/bindings.ts'
import { createDraft, isDraftDirty, isLocalGuide, useGuideEdit } from '@/lib/guide_edit.ts'
import { useRevertGuide } from '@/mutations/revert_guide.mutation.ts'
import { useSaveGuide } from '@/mutations/save_guide.mutation.ts'

/**
 * Edition mode of a guide. Everything is edited on a local draft: nothing reaches the
 * disk (nor the server) before "Enregistrer". The draft lives in the `useGuideEdit`
 * store so switching step or tab does not lose the work in progress.
 */
export function GuideEditPanel({
  guide,
  stepIndex,
  onChangeStep,
}: {
  guide: GuideWithSteps
  stepIndex: number
  onChangeStep: (stepIndex: number) => Promise<boolean>
}) {
  const { t } = useLingui()
  const [showPreview, setShowPreview] = useState(false)
  const contentRef = useRef<HTMLTextAreaElement>(null)

  const drafts = useGuideEdit((state) => state.drafts)
  const renameGuide = useGuideEdit((state) => state.renameGuide)
  const updateStep = useGuideEdit((state) => state.updateStep)
  const addStep = useGuideEdit((state) => state.addStep)
  const duplicateStep = useGuideEdit((state) => state.duplicateStep)
  const removeStep = useGuideEdit((state) => state.removeStep)
  const moveStep = useGuideEdit((state) => state.moveStep)
  const resetDraft = useGuideEdit((state) => state.resetDraft)
  const stopEdit = useGuideEdit((state) => state.stopEdit)

  const startEdit = useGuideEdit((state) => state.startEdit)

  const saveGuide = useSaveGuide()
  const revertGuide = useRevertGuide()

  // Opening another guide while the edition mode is active must not leave the panel
  // without a draft: nothing could be typed into a draft that does not exist yet.
  useEffect(() => {
    if (!useGuideEdit.getState().drafts[guide.id]) {
      startEdit(guide)
    }
  }, [guide, startEdit])

  // The draft is created when the edition mode starts; this fallback covers a guide
  // opened while the mode was already active.
  const draft = drafts[guide.id] ?? createDraft(guide)
  const dirty = isDraftDirty(drafts[guide.id], guide)

  const safeIndex = Math.min(stepIndex, draft.steps.length - 1)
  const step: GuideStep | undefined = draft.steps[safeIndex]
  const isFirstStep = safeIndex <= 0
  const isLastStep = safeIndex >= draft.steps.length - 1

  const goToStep = async (index: number) => {
    if (index === safeIndex) {
      return
    }

    await onChangeStep(index)
  }

  const onAddStep = async () => {
    const insertedAt = addStep(guide.id, safeIndex)
    toast.success(t`Étape ajoutée`)
    await onChangeStep(insertedAt)
  }

  const onDuplicateStep = async () => {
    const insertedAt = duplicateStep(guide.id, safeIndex)
    toast.success(t`Étape dupliquée`)
    await onChangeStep(insertedAt)
  }

  const onRemoveStep = async () => {
    if (draft.steps.length <= 1) {
      toast.error(t`Un guide doit conserver au moins une étape`)

      return
    }

    const targetIndex = safeIndex === 0 ? 0 : safeIndex - 1

    removeStep(guide.id, safeIndex)
    toast.success(t`Étape supprimée`)

    if (safeIndex > draft.steps.length - 2) {
      await onChangeStep(targetIndex)
    }
  }

  const onSave = () => {
    saveGuide.mutate(
      { guideId: guide.id, name: draft.name, steps: draft.steps },
      {
        onSuccess: (savedGuide) => {
          resetDraft(savedGuide)
          toast.success(t`Guide enregistré`)
        },
        onError: () => {
          toast.error(t`Impossible d'enregistrer le guide`)
        },
      },
    )
  }

  const onRevert = () => {
    revertGuide.mutate(
      { guideId: guide.id },
      {
        onSuccess: (restoredGuide) => {
          resetDraft(restoredGuide)
          toast.success(t`Guide original restauré`)
          onChangeStep(0)
        },
        onError: () => {
          toast.error(t`Impossible de restaurer le guide original`)
        },
      },
    )
  }

  const onDiscard = () => {
    resetDraft(guide)
    toast(t`Modifications abandonnées`)
  }

  /**
   * Append a coordinate at the caret of the content editor so the user does not have to
   * write the `[x,y]` syntax by hand. Written coordinates become clickable positions.
   */
  const insertAtCaret = (text: string) => {
    if (!step) {
      return
    }

    const textarea = contentRef.current
    const current = step.web_text
    const start = textarea?.selectionStart ?? current.length
    const end = textarea?.selectionEnd ?? current.length
    const next = `${current.slice(0, start)}${text}${current.slice(end)}`

    updateStep(guide.id, safeIndex, { web_text: next })

    requestAnimationFrame(() => {
      const caret = start + text.length
      textarea?.focus()
      textarea?.setSelectionRange(caret, caret)
    })
  }

  return (
    <div className="flex flex-col gap-2 px-2 pt-2 pb-6">
      <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border-muted bg-surface-card p-2">
        <Badge variant="secondary">
          <Trans>Mode édition</Trans>
        </Badge>
        {dirty ? (
          <span className="text-xs text-orange-400">
            <Trans>Modifications non enregistrées</Trans>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">
            <Trans>Aucune modification</Trans>
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <Button disabled={!dirty || saveGuide.isPending} onClick={onSave} size="icon" title={t`Enregistrer le guide`}>
            <SaveIcon />
          </Button>
          <Button
            disabled={!dirty}
            onClick={onDiscard}
            size="icon"
            title={t`Abandonner les modifications`}
            variant="secondary"
          >
            <Undo2Icon />
          </Button>
          <Button onClick={() => stopEdit()} size="icon" title={t`Quitter le mode édition`} variant="ghost">
            <XIcon />
          </Button>
        </div>
      </div>

      {!isLocalGuide(guide.id) && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button className="w-full" disabled={revertGuide.isPending} size="sm" variant="outline">
              <RotateCcwIcon />
              <Trans>Rétablir le guide original</Trans>
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                <Trans>Rétablir le guide original ?</Trans>
              </AlertDialogTitle>
              <AlertDialogDescription>
                <Trans>
                  Vos modifications locales seront remplacées par la version de Ganymède. Une copie de la version
                  d'origine reste disponible dans le dossier des guides.
                </Trans>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>
                <Trans>Annuler</Trans>
              </AlertDialogCancel>
              <AlertDialogAction onClick={onRevert}>
                <Trans>Rétablir</Trans>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      <div className="flex flex-col gap-1">
        <Label htmlFor="guide-name">
          <Trans>Nom du guide</Trans>
        </Label>
        <Input
          id="guide-name"
          onChange={(event) => renameGuide(guide.id, event.currentTarget.value)}
          value={draft.name}
        />
      </div>

      <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border-muted bg-surface-card p-2">
        <Button
          disabled={isFirstStep}
          onClick={() => goToStep(safeIndex - 1)}
          size="icon"
          title={t`Étape précédente`}
          variant="secondary"
        >
          <ChevronLeftIcon />
        </Button>
        <span className="text-xs text-muted-foreground">
          {safeIndex + 1} / {draft.steps.length}
        </span>
        <Button
          disabled={isLastStep}
          onClick={() => goToStep(safeIndex + 1)}
          size="icon"
          title={t`Étape suivante`}
          variant="secondary"
        >
          <ChevronRightIcon />
        </Button>

        <div className="ml-auto flex items-center gap-1">
          <Button onClick={onAddStep} size="icon" title={t`Ajouter une étape après celle-ci`} variant="secondary">
            <PlusIcon />
          </Button>
          <Button onClick={onDuplicateStep} size="icon" title={t`Dupliquer cette étape`} variant="secondary">
            <CopyIcon />
          </Button>
          <Button
            disabled={isFirstStep}
            onClick={async () => {
              moveStep(guide.id, safeIndex, -1)
              // The edited step follows its new position in the list.
              await goToStep(safeIndex - 1)
            }}
            size="icon"
            title={t`Monter l'étape`}
            variant="secondary"
          >
            <ArrowUpIcon />
          </Button>
          <Button
            disabled={isLastStep}
            onClick={async () => {
              moveStep(guide.id, safeIndex, 1)
              await goToStep(safeIndex + 1)
            }}
            size="icon"
            title={t`Descendre l'étape`}
            variant="secondary"
          >
            <ArrowDownIcon />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="icon" title={t`Supprimer cette étape`} variant="destructive">
                <TrashIcon />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  <Trans>Supprimer cette étape ?</Trans>
                </AlertDialogTitle>
                <AlertDialogDescription>
                  <Trans>
                    L'étape et son contenu seront retirés du guide lors du prochain enregistrement. Les autres étapes ne
                    sont pas modifiées.
                  </Trans>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>
                  <Trans>Annuler</Trans>
                </AlertDialogCancel>
                <AlertDialogAction onClick={onRemoveStep}>
                  <Trans>Supprimer</Trans>
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {step && (
        <>
          <div className="flex flex-col gap-1">
            <Label htmlFor="step-name">
              <Trans>Nom de l'étape</Trans>
            </Label>
            <Input
              id="step-name"
              onChange={(event) => updateStep(guide.id, safeIndex, { name: event.currentTarget.value })}
              placeholder={t`Nom de l'étape`}
              value={step.name ?? ''}
            />
          </div>

          <div className="grid grid-cols-4 gap-1">
            <div className="flex flex-col gap-1">
              <Label htmlFor="step-x">
                <Trans>X</Trans>
              </Label>
              <Input
                id="step-x"
                onChange={(event) =>
                  updateStep(guide.id, safeIndex, { pos_x: Number.parseInt(event.currentTarget.value) || 0 })
                }
                type="number"
                value={step.pos_x}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="step-y">
                <Trans>Y</Trans>
              </Label>
              <Input
                id="step-y"
                onChange={(event) =>
                  updateStep(guide.id, safeIndex, { pos_y: Number.parseInt(event.currentTarget.value) || 0 })
                }
                type="number"
                value={step.pos_y}
              />
            </div>
            <div className="col-span-2 flex flex-col gap-1">
              <Label htmlFor="step-map">
                <Trans>Carte</Trans>
              </Label>
              <Input
                id="step-map"
                onChange={(event) =>
                  updateStep(guide.id, safeIndex, {
                    map: event.currentTarget.value.trim() === '' ? null : event.currentTarget.value,
                  })
                }
                placeholder={t`Nom de la carte`}
                value={step.map ?? ''}
              />
            </div>
          </div>

          <Tabs
            className="flex flex-col gap-1"
            onValueChange={(value) => setShowPreview(value === 'preview')}
            value={showPreview ? 'preview' : 'content'}
          >
            <TabsList>
              <TabsTrigger value="content">
                <Trans>Contenu</Trans>
              </TabsTrigger>
              <TabsTrigger value="preview">
                <Trans>Aperçu</Trans>
              </TabsTrigger>
            </TabsList>

            <TabsContent className="flex flex-col gap-1" value="content">
              <div className="flex flex-wrap items-center gap-1">
                <Button
                  onClick={() => insertAtCaret(`[${step.pos_x},${step.pos_y}]`)}
                  size="sm"
                  title={t`Insérer les coordonnées de l'étape à l'endroit du curseur`}
                  variant="outline"
                >
                  <Trans>
                    Insérer [{step.pos_x},{step.pos_y}]
                  </Trans>
                </Button>
              </div>
              <Textarea
                className="min-h-[220px] font-mono text-xs leading-4"
                onChange={(event) => updateStep(guide.id, safeIndex, { web_text: event.currentTarget.value })}
                placeholder={t`Contenu de l'étape. Les coordonnées [x,y] deviennent cliquables.`}
                ref={contentRef}
                spellCheck={false}
                value={step.web_text}
              />
            </TabsContent>

            <TabsContent value="preview">
              <GuideFrame
                className="guide rounded-lg border border-border-muted px-2 pt-2 leading-5"
                guideId={guide.id}
                html={step.web_text}
                stepIndex={safeIndex}
              />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  )
}
