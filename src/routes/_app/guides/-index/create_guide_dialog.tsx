import { Trans, useLingui } from '@lingui/react/macro'
import { useNavigate } from '@tanstack/react-router'
import { PlusIcon } from 'lucide-react'
import { PropsWithChildren, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button.tsx'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog.tsx'
import { Input } from '@/components/ui/input.tsx'
import { Label } from '@/components/ui/label.tsx'
import { useGuideEdit } from '@/lib/guide_edit.ts'
import { useCreateLocalGuide } from '@/mutations/create_local_guide.mutation.ts'

/**
 * Create an empty guide on the user's disk and open it directly in the edition mode.
 */
export function CreateGuideDialog({ folder }: PropsWithChildren<{ folder: string }>) {
  const { t } = useLingui()
  const navigate = useNavigate()
  const createGuide = useCreateLocalGuide()
  const startEdit = useGuideEdit((state) => state.startEdit)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')

  const onSubmit = () => {
    createGuide.mutate(
      { name: name.trim(), folder },
      {
        onSuccess: async (guide) => {
          startEdit(guide)
          setOpen(false)
          setName('')
          toast.success(t`Guide créé`)

          await navigate({
            to: '/guides/$id',
            params: { id: guide.id },
            search: { step: 0 },
          })
        },
        onError: () => {
          toast.error(t`Impossible de créer le guide`)
        },
      },
    )
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button
          className="size-6 min-h-6 min-w-6 sm:size-7 sm:min-h-7 sm:min-w-7"
          size="icon-sm"
          title={t`Créer un guide`}
          variant="secondary"
        >
          <PlusIcon className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Trans>Créer un guide</Trans>
          </DialogTitle>
          <DialogDescription>
            <Trans>Le guide est créé sur votre ordinateur et s'ouvre en mode édition.</Trans>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1">
          <Label htmlFor="create-guide-name">
            <Trans>Nom du guide</Trans>
          </Label>
          <Input
            autoFocus
            id="create-guide-name"
            onChange={(event) => setName(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                onSubmit()
              }
            }}
            placeholder={t`Mon guide`}
            value={name}
          />
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">
              <Trans>Annuler</Trans>
            </Button>
          </DialogClose>
          <Button disabled={createGuide.isPending} onClick={onSubmit}>
            <Trans>Créer</Trans>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
