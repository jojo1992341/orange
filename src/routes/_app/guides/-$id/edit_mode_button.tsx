import { useLingui } from '@lingui/react/macro'
import { PencilIcon, SquarePenIcon } from 'lucide-react'

import { Button } from '@/components/ui/button.tsx'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip.tsx'
import { cn } from '@/lib/utils.ts'

/**
 * Entry point of the guide edition mode. It is a plain icon in the guide header so it
 * stays reachable whatever the window size: the "..." dropdown holding the other
 * actions is only rendered below the `xs` breakpoint (320px).
 */
export function GuideEditModeButton({
  isEditMode,
  isPending,
  onClick,
}: {
  isEditMode: boolean
  isPending: boolean
  onClick: () => void
}) {
  const { t } = useLingui()
  const label = isEditMode ? t`Quitter le mode édition` : t`Mode édition`

  return (
    <TooltipProvider delayDuration={400}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            aria-label={label}
            aria-pressed={isEditMode}
            className={cn('size-6 sm:size-8', isEditMode && 'text-accent')}
            disabled={isPending}
            onClick={onClick}
            size="icon"
            variant="ghost"
          >
            {isEditMode ? <SquarePenIcon /> : <PencilIcon />}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
