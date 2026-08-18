import { createBrowserRouter } from 'react-router-dom';
import type { QueryClient } from '@tanstack/react-query';
import { AppLayout } from './components/AppLayout';
import { HomePage } from './pages/HomePage';
import { AuthPage } from './pages/AuthPage';
import { SettingsPage } from './pages/SettingsPage';
import { EditorPage } from './pages/EditorPage';
import { ArticlePage } from './pages/ArticlePage';
import { ProfilePage } from './pages/ProfilePage';
import { ProfileArticles } from './pages/ProfileArticles';
import { ProfileFavorites } from './pages/ProfileFavorites';
import { RequireAuth } from './auth/RequireAuth';
import { GuestOnly } from './auth/GuestOnly';
import { articleQueryOptions } from './hooks/useArticles';
import { commentsQueryOptions } from './hooks/useComments';
import { profileQueryOptions } from './hooks/useProfile';

async function prefetch(promise: Promise<unknown>) {
  try {
    await promise;
  } catch {
    // Query error state is consumed by the page via useQuery
  }
}

export function createAppRouter(queryClient: QueryClient) {
  return createBrowserRouter([
    {
      path: '/',
      element: <AppLayout />,
      children: [
        { index: true, element: <HomePage /> },
        { path: 'tag/:tag', element: <HomePage /> },
        {
          element: <GuestOnly />,
          children: [
            { path: 'login', element: <AuthPage /> },
            { path: 'register', element: <AuthPage /> },
          ],
        },
        {
          element: <RequireAuth />,
          children: [
            { path: 'settings', element: <SettingsPage /> },
            { path: 'editor', element: <EditorPage /> },
            {
              path: 'editor/:slug',
              element: <EditorPage />,
              loader: async ({ params }) => {
                if (params.slug) {
                  await prefetch(queryClient.ensureQueryData(articleQueryOptions(params.slug)));
                }
                return null;
              },
            },
          ],
        },
        {
          path: 'article/:slug',
          element: <ArticlePage />,
          loader: async ({ params }) => {
            if (params.slug) {
              await Promise.all([
                prefetch(queryClient.ensureQueryData(articleQueryOptions(params.slug))),
                prefetch(queryClient.ensureQueryData(commentsQueryOptions(params.slug))),
              ]);
            }
            return null;
          },
        },
        {
          path: 'profile/:username',
          element: <ProfilePage />,
          loader: async ({ params }) => {
            if (params.username) {
              await prefetch(queryClient.ensureQueryData(profileQueryOptions(params.username)));
            }
            return null;
          },
          children: [
            { index: true, element: <ProfileArticles /> },
            { path: 'favorites', element: <ProfileFavorites /> },
          ],
        },
      ],
    },
  ]);
}
