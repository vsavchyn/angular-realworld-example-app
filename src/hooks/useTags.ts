import { useQuery } from '@tanstack/react-query';
import { getTags } from '../api/tags';

export const tagsQueryKey = ['tags'] as const;

export function useTags() {
  return useQuery({
    queryKey: tagsQueryKey,
    queryFn: getTags,
  });
}
