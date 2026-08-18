import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addComment, deleteComment, getComments } from '../api/comments';
import type { Comment } from '../models/comment.model';

export function commentsQueryKey(slug: string) {
  return ['comments', slug] as const;
}

export function commentsQueryOptions(slug: string) {
  return {
    queryKey: commentsQueryKey(slug),
    queryFn: () => getComments(slug),
  };
}

export function useComments(slug: string | undefined) {
  return useQuery({
    ...commentsQueryOptions(slug ?? ''),
    enabled: !!slug,
  });
}

export function useAddComment(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => addComment(slug, body),
    onSuccess: comment => {
      queryClient.setQueryData<Comment[]>(commentsQueryKey(slug), current =>
        current ? [comment, ...current] : [comment],
      );
    },
  });
}

export function useDeleteComment(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => deleteComment(commentId, slug),
    onSuccess: (_data, commentId) => {
      queryClient.setQueryData<Comment[]>(commentsQueryKey(slug), current =>
        current ? current.filter(comment => comment.id !== commentId) : current,
      );
    },
  });
}
