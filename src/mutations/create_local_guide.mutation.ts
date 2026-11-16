import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createLocalGuide } from '@/ipc/guides.ts'

export function useCreateLocalGuide() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ name, folder }: { name: string; folder: string }) => {
      const result = await createLocalGuide(name, folder)

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
