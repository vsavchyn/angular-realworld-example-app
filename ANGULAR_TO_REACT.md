# Angular → React mapping

This Conduit rebuild keeps the RealWorld API, routes, templates, and e2e contract. Angular platform APIs are replaced with React idioms — **not** a line-by-line RxJS port.

## Guards → route wrappers

| Angular                                                          | React                                                                                    | Behavior                   |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------- |
| `requireAuth` `canActivate` in `app.routes.ts`                   | [`RequireAuth`](src/auth/RequireAuth.tsx) around `/settings`, `/editor`, `/editor/:slug` | No current user → `/login` |
| Guest-only `canActivate` on `/login` and `/register` (`!isAuth`) | [`GuestOnly`](src/auth/GuestOnly.tsx)                                                    | Authenticated → `/`        |
| Home `feed=following` while logged out (component, not a guard)  | [`HomePage`](src/pages/HomePage.tsx) `<Navigate to="/login">`                            | Same redirect              |

## Resolver → loader

This Angular app had **no** `ResolveFn`s; pages loaded data in `ngOnInit`. The equivalent is a React Router **loader** that prefetches into the React Query cache:

| Angular                            | React                                                                                                 |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `ResolveFn` / route `resolve`      | `loader` + `queryClient.ensureQueryData(...)`                                                         |
| `ngOnInit` + `ArticlesService.get` | [`articleQueryOptions`](src/hooks/useArticles.ts) in the `/article/:slug` and `/editor/:slug` loaders |
| `ngOnInit` + `ProfileService.get`  | [`profileQueryOptions`](src/hooks/useProfile.ts) in the `/profile/:username` loader                   |
| Component still owns the UI state  | Pages call `useQuery` / `useArticle` / `useProfile` (cache hit, no second fetch)                      |

## Interceptor → fetch middleware

All three Angular interceptors are one [`apiFetch`](src/api/client.ts) function:

| Angular interceptor | React                                                                                                                      |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `apiInterceptor`    | Prefix `https://api.realworld.show/api`                                                                                    |
| `tokenInterceptor`  | `Authorization: Token <jwt>` when `localStorage['jwtToken']` is set                                                        |
| `errorInterceptor`  | 401 on any path except `/user` → `purgeAuth()`; body normalized to `{ errors, status }`; network fallback `errors.network` |

## Services / DI → hooks + query keys

| Angular service   | React                                                                                            | Query key                                |
| ----------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| `UserService`     | [`useAuth`](src/auth/useAuth.ts), `useLogin`, `useRegister`, `useUpdateUser`, `useLogout`        | `['user']`                               |
| `ArticlesService` | [`useArticles`](src/hooks/useArticles.ts), `useArticle`, create/update/delete/favorite mutations | `['articles', ...]`, `['article', slug]` |
| `CommentsService` | [`useComments`](src/hooks/useComments.ts)                                                        | `['comments', slug]`                     |
| `TagsService`     | [`useTags`](src/hooks/useTags.ts)                                                                | `['tags']`                               |
| `ProfileService`  | [`useProfile`](src/hooks/useProfile.ts)                                                          | `['profile', username]`                  |
| `JwtService`      | [`src/auth/jwt.ts`](src/auth/jwt.ts)                                                             | `localStorage['jwtToken']`               |

Plain async functions live under [`src/api/`](src/api/) so HTTP can be unit-tested without rendering. Hooks wrap those functions with React Query.

## RxJS → React Query (not operator chains)

| RxJS                                             | React Query / React                                                                                              |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `BehaviorSubject` + `distinctUntilChanged`       | Query cache + selectors                                                                                          |
| `shareReplay(1)`                                 | Query cache                                                                                                      |
| `combineLatest([article$, comments$, user$])`    | Parallel `useArticle` + `useComments` + `useAuth`                                                                |
| `switchMap(auth → mutate)`                       | `useMutation` that reads `useAuth()` then POSTs (unauthenticated → navigate)                                     |
| `takeUntilDestroyed`                             | Query unmount cancellation                                                                                       |
| `catchError`                                     | `isError` / mutation `onError` / `apiFetch` throw                                                                |
| `timer` + exponential backoff on GET `/user` 5xx | `retry: false` + `refetchInterval` `min(2000 * 2^(n-1), 16000)` so **Connecting...** paints on the first failure |
| `tap(setAuth)`                                   | `setQueryData(['user'], user)` in login/register                                                                 |
| `APP_INITIALIZER` / `initAuth`                   | [`bootstrapAuth`](src/auth/session.ts) before first paint                                                        |
| `IfAuthenticatedDirective`                       | `useAuth().isAuthenticated` + conditional render                                                                 |
| `MarkdownPipe` + `DomSanitizer`                  | [`Markdown`](src/components/Markdown.tsx) (`marked` + DOMPurify)                                                 |
| `DefaultImagePipe`                               | [`defaultImage()`](src/utils/image.ts)                                                                           |

There is **no** `rxjs` dependency. Do not wrap `fetch` in `Observable` / `switchMap` / `combineLatest`.

## Reactive forms → react-hook-form

| Angular                         | React                                                                 |
| ------------------------------- | --------------------------------------------------------------------- |
| `FormGroup` login/register      | [`AuthPage`](src/pages/AuthPage.tsx) `useForm`                        |
| Settings `FormGroup`            | [`SettingsPage`](src/pages/SettingsPage.tsx) `useForm`                |
| Editor `FormGroup` + tag signal | [`EditorPage`](src/pages/EditorPage.tsx) `useForm` + `tagList` state  |
| Comment `FormControl`           | Controlled `<textarea>` on [`ArticlePage`](src/pages/ArticlePage.tsx) |
| `Validators.required`           | `register(..., { required: true })`                                   |
| `name` attributes for e2e       | Kept (`email`, `password`, `title`, …)                                |

## Auth states

Same four states as Angular `UserService`: `loading` | `authenticated` | `unauthenticated` | `unavailable`.

- **4XX** on GET `/user` → clear token, show Sign in / Sign up
- **5XX / network / malformed JSON** → keep token, show **Connecting...**, retry 2s → 4s → 8s → 16s cap
- 401 on **other** endpoints → `purgeAuth`
- Debug: `window.__conduit_debug__` (`getToken`, `getAuthState`, `getCurrentUser`)
