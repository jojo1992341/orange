import { useMutation, useQueryClient } from '@tanstack/react-query'

import { revertGuideToServer } from '@/ipc/guides.ts'
import { hasGuidesNotUpdatedQuery } from '@/queries/has_guides_not_updated.query.ts'

export function useRevertGuide() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ guideId }: { guideId: number }) => {
      const result = await revertGuideToServer(guideId)

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['conf', 'guides'] })
      await queryClient.invalidateQueries({ queryKey: ['guides', 'summary'] })
      await queryClient.invalidateQueries(hasGuidesNotUpdatedQuery)
    },
  })
}
