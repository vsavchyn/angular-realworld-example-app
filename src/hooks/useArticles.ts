import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createArticle,
  deleteArticle,
  favoriteArticle,
  getArticle,
  queryArticles,
  unfavoriteArticle,
  updateArticle,
} from '../api/articles';
import type { Article } from '../models/article.model';
import type { ArticleListConfig } from '../models/article-list-config.model';

export function articlesQueryKey(config: ArticleListConfig, page: number, limit: number) {
  return ['articles', config.type, config.filters, page, limit] as const;
}

export function articleQueryKey(slug: string) {
  return ['article', slug] as const;
}

export function articleQueryOptions(slug: string) {
  return {
    queryKey: articleQueryKey(slug),
    queryFn: () => getArticle(slug),
  };
}

export function useArticles(config: ArticleListConfig, page: number, limit: number) {
  const queryConfig: ArticleListConfig = {
    type: config.type,
    filters: {
      ...config.filters,
      limit,
      offset: limit * (page - 1),
    },
  };

  return useQuery({
    queryKey: articlesQueryKey(config, page, limit),
    queryFn: () => queryArticles(queryConfig),
  });
}

export function useArticle(slug: string | undefined) {
  return useQuery({
    ...articleQueryOptions(slug ?? ''),
    enabled: !!slug,
  });
}

export function useCreateArticle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (article: Partial<Article>) => createArticle(article),
    onSuccess: article => {
      queryClient.setQueryData(articleQueryKey(article.slug), article);
      void queryClient.invalidateQueries({ queryKey: ['articles'] });
    },
  });
}

export function useUpdateArticle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (article: Partial<Article>) => updateArticle(article),
    onSuccess: article => {
      queryClient.setQueryData(articleQueryKey(article.slug), article);
      void queryClient.invalidateQueries({ queryKey: ['articles'] });
    },
  });
}

export function useDeleteArticle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (slug: string) => deleteArticle(slug),
    onSuccess: (_data, slug) => {
      queryClient.removeQueries({ queryKey: articleQueryKey(slug) });
      void queryClient.invalidateQueries({ queryKey: ['articles'] });
    },
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ slug, favorited }: { slug: string; favorited: boolean }) => {
      if (favorited) {
        await unfavoriteArticle(slug);
        return { slug, favorited: false };
      }
      const article = await favoriteArticle(slug);
      return { slug, favorited: article.favorited };
    },
    onSuccess: ({ slug, favorited }) => {
      queryClient.setQueryData<Article>(articleQueryKey(slug), current =>
        current
          ? {
              ...current,
              favorited,
              favoritesCount: favorited ? current.favoritesCount + 1 : current.favoritesCount - 1,
            }
          : current,
      );
      queryClient.setQueriesData<{ articles: Article[]; articlesCount: number }>({ queryKey: ['articles'] }, old => {
        if (!old) {
          return old;
        }
        return {
          ...old,
          articles: old.articles.map(article =>
            article.slug === slug
              ? {
                  ...article,
                  favorited,
                  favoritesCount: favorited ? article.favoritesCount + 1 : article.favoritesCount - 1,
                }
              : article,
          ),
        };
      });
    },
  });
}
