import { apiFetch } from './client';
import type { Article } from '../models/article.model';
import type { ArticleListConfig } from '../models/article-list-config.model';

export function queryArticles(config: ArticleListConfig): Promise<{ articles: Article[]; articlesCount: number }> {
  const params = new URLSearchParams();
  Object.entries(config.filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      params.set(key, String(value));
    }
  });
  const path = '/articles' + (config.type === 'feed' ? '/feed' : '');
  const qs = params.toString();
  return apiFetch<{ articles: Article[]; articlesCount: number }>(`${path}${qs ? `?${qs}` : ''}`);
}

export async function getArticle(slug: string): Promise<Article> {
  const data = await apiFetch<{ article: Article }>(`/articles/${slug}`);
  return data.article;
}

export function deleteArticle(slug: string): Promise<void> {
  return apiFetch<void>(`/articles/${slug}`, { method: 'DELETE' });
}

export async function createArticle(article: Partial<Article>): Promise<Article> {
  const data = await apiFetch<{ article: Article }>('/articles', {
    method: 'POST',
    body: JSON.stringify({ article }),
  });
  return data.article;
}

export async function updateArticle(article: Partial<Article>): Promise<Article> {
  const data = await apiFetch<{ article: Article }>(`/articles/${article.slug}`, {
    method: 'PUT',
    body: JSON.stringify({ article }),
  });
  return data.article;
}

export async function favoriteArticle(slug: string): Promise<Article> {
  const data = await apiFetch<{ article: Article }>(`/articles/${slug}/favorite`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  return data.article;
}

export function unfavoriteArticle(slug: string): Promise<void> {
  return apiFetch<void>(`/articles/${slug}/favorite`, { method: 'DELETE' });
}
