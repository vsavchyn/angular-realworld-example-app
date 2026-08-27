import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { followUser, getProfile, unfollowUser } from '../api/profiles';
import type { Profile } from '../models/profile.model';
import type { Article } from '../models/article.model';
import { articleQueryKey } from './useArticles';

export function profileQueryKey(username: string) {
  return ['profile', username] as const;
}

export function profileQueryOptions(username: string) {
  return {
    queryKey: profileQueryKey(username),
    queryFn: () => getProfile(username),
  };
}

export function useProfile(username: string | undefined) {
  return useQuery({
    ...profileQueryOptions(username ?? ''),
    enabled: !!username,
  });
}

export function useToggleFollow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ username, following }: { username: string; following: boolean }) => {
      return following ? unfollowUser(username) : followUser(username);
    },
    onSuccess: profile => {
      queryClient.setQueryData(profileQueryKey(profile.username), profile);
      queryClient.setQueriesData<Article>({ queryKey: ['article'] }, article => {
        if (!article || article.author.username !== profile.username) {
          return article;
        }
        return { ...article, author: { ...article.author, following: profile.following } };
      });
    },
  });
}
