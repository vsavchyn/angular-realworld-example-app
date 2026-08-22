import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createArticle,
  deleteArticle,
  favoriteArticle,
  getArticle,
  queryArticles,
  unfavoriteArticle,
  updateArticle,
} from './articles';
import { API_BASE } from './client';
import type { Article } from '../models/article.model';

const mockArticle: Article = {
  slug: 'test-article',
  title: 'Test Article',
  description: 'Test description',
  body: 'Test body content',
  tagList: ['test', 'react'],
  createdAt: '2024-01-01',
  updatedAt: '2024-01-02',
  favorited: false,
  favoritesCount: 5,
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

describe('articles api', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    window.localStorage.removeItem('jwtToken');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('fetches articles with default config', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ articles: [mockArticle], articlesCount: 1 }));
    const result = await queryArticles({ type: 'all', filters: {} });
    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/articles`, expect.any(Object));
    expect(result.articles).toEqual([mockArticle]);
  });

  it('fetches feed articles when type is feed', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ articles: [mockArticle], articlesCount: 1 }));
    await queryArticles({ type: 'feed', filters: {} });
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE}/articles/feed`);
  });

  it('includes query parameters from filters', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ articles: [], articlesCount: 0 }));
    await queryArticles({
      type: 'all',
      filters: { tag: 'angular', author: 'testuser', limit: 10, offset: 0 },
    });
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get('tag')).toBe('angular');
    expect(url.searchParams.get('author')).toBe('testuser');
    expect(url.searchParams.get('limit')).toBe('10');
    expect(url.searchParams.get('offset')).toBe('0');
  });

  it('fetches a single article by slug', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ article: mockArticle }));
    await expect(getArticle('test-article')).resolves.toEqual(mockArticle);
  });

  it('encodes slug path segments', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ article: mockArticle }));
    await getArticle('a/b?x=1');
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE}/articles/${encodeURIComponent('a/b?x=1')}`);
  });

  it('unwraps article from create/update/favorite responses', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({ article: mockArticle })));
    await expect(createArticle({ title: 'New' })).resolves.toEqual(mockArticle);
    await expect(updateArticle({ slug: 'test-article', title: 'Updated' })).resolves.toEqual(mockArticle);
    await expect(favoriteArticle('test-article')).resolves.toEqual(mockArticle);
  });

  it('deletes and unfavorites by slug', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response('', { status: 200 })));
    await deleteArticle('test-article');
    await unfavoriteArticle('test-article');
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
    expect(fetchMock.mock.calls[1][0]).toBe(`${API_BASE}/articles/test-article/favorite`);
  });

  it('surfaces HTTP errors', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ errors: { article: ['not found'] } }, 404));
    await expect(getArticle('missing')).rejects.toMatchObject({ status: 404 });
  });
});
