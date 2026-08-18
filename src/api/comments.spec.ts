import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addComment, deleteComment, getComments } from './comments';
import { API_BASE } from './client';
import type { Comment } from '../models/comment.model';

const mockComment: Comment = {
  id: '1',
  body: 'Test comment',
  createdAt: '2024-01-01',
  author: {
    username: 'testuser',
    bio: 'Test bio',
    image: 'https://example.com/avatar.jpg',
    following: false,
  },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('comments api', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    window.localStorage.removeItem('jwtToken');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('fetches and unwraps comments', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ comments: [mockComment] }));
    const comments = await getComments('test-article');
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE}/articles/test-article/comments`);
    expect(comments).toEqual([mockComment]);
    expect((comments as unknown as { comments?: unknown }).comments).toBeUndefined();
  });

  it('posts a comment body wrapper', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ comment: mockComment }));
    const comment = await addComment('test-article', 'Hello');
    expect(fetchMock.mock.calls[0][1].body).toBe(JSON.stringify({ comment: { body: 'Hello' } }));
    expect(comment).toEqual(mockComment);
  });

  it('deletes a comment by id', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 200 }));
    await deleteComment('123', 'test-article');
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE}/articles/test-article/comments/123`);
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
  });

  it('surfaces HTTP errors', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ errors: { comment: ['not found'] } }, 404));
    await expect(getComments('missing')).rejects.toMatchObject({ status: 404 });
  });
});
