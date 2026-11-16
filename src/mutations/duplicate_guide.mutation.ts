import { useMutation, useQueryClient } from '@tanstack/react-query'

import { duplicateGuide } from '@/ipc/guides.ts'

export function useDuplicateGuide() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ guideId }: { guideId: number }) => {
      const result = await duplicateGuide(guideId)

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['conf', 'guides'] })
    },
  })
}
