import { useMutation, useQueryClient } from '@tanstack/react-query'

import { GuideStep } from '@/ipc/bindings.ts'
import { saveGuide } from '@/ipc/guides.ts'
import { hasGuidesNotUpdatedQuery } from '@/queries/has_guides_not_updated.query.ts'

export function useSaveGuide() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ guideId, name, steps }: { guideId: number; name: string; steps: GuideStep[] }) => {
      const result = await saveGuide(guideId, name, steps)

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    },
    onSuccess: async (guide) => {
      await queryClient.invalidateQueries({ queryKey: ['conf', 'guides'] })
      await queryClient.invalidateQueries({ queryKey: ['guides', 'summary'] })
      await queryClient.invalidateQueries(hasGuidesNotUpdatedQuery)

      queryClient.setQueryData(['conf', 'guides', ''], (guides: unknown) => {
        if (!Array.isArray(guides)) {
          return guides
        }

        return guides.map((current) =>
          current && typeof current === 'object' && current.id === guide.id ? guide : current,
        )
      })
    },
  })
}
