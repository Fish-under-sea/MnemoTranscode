// frontend/src/hooks/useCapsules.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { capsuleApi, type CapsuleItem } from '@/services/api'

export function useCapsuleList(memberId?: number) {
  return useQuery<CapsuleItem[]>({
    queryKey: ['capsules', memberId],
    queryFn: () => capsuleApi.list(memberId ? { member_id: memberId } : undefined),
  })
}

export function useCapsuleDetail(id: number | null) {
  return useQuery<CapsuleItem>({
    queryKey: ['capsule', id],
    queryFn: () => capsuleApi.get(id!),
    enabled: id !== null,
  })
}

export function useCreateCapsule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: capsuleApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['capsules'] })
      toast.success('记忆胶囊已创建，将于指定时间解封')
    },
    onError: () => {
      toast.error('创建失败，请重试')
    },
  })
}
