import { apiFetch } from './client';
import type { Comment } from '../models/comment.model';

export async function getComments(slug: string): Promise<Comment[]> {
  const data = await apiFetch<{ comments: Comment[] }>(`/articles/${encodeURIComponent(slug)}/comments`);
  return data.comments;
}

export async function addComment(slug: string, payload: string): Promise<Comment> {
  const data = await apiFetch<{ comment: Comment }>(`/articles/${encodeURIComponent(slug)}/comments`, {
    method: 'POST',
    body: JSON.stringify({ comment: { body: payload } }),
  });
  return data.comment;
}

export function deleteComment(commentId: string, slug: string): Promise<void> {
  return apiFetch<void>(`/articles/${encodeURIComponent(slug)}/comments/${encodeURIComponent(commentId)}`, {
    method: 'DELETE',
  });
}
