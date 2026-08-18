import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { setUnauthorizedHandler } from './api/client';
import { bindQueryClient, bootstrapAuth, purgeAuth } from './auth/session';
import { setupDebugInterface } from './auth/debug';
import { createAppRouter } from './routes';
import '../realworld/assets/theme/styles.css';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

bindQueryClient(queryClient);
setUnauthorizedHandler(purgeAuth);
setupDebugInterface(queryClient);

const router = createAppRouter(queryClient);

async function start() {
  await bootstrapAuth(queryClient);

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  );
}

void start();
