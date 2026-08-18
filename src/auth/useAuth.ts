import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { loginUser, registerUser, updateUser } from '../api/users';
import type { User } from '../models/user.model';
import { hasToken } from './jwt';
import { purgeAuth, setAuth, setCurrentUser, userQueryOptions } from './session';
import type { AuthState } from './types';
import { isClientError } from '../api/client';

export function useAuth() {
  const query = useQuery({
    ...userQueryOptions(),
    enabled: hasToken(),
  });

  let authState: AuthState;
  if (!hasToken()) {
    authState = 'unauthenticated';
  } else if (query.isPending) {
    authState = 'loading';
  } else if (query.isSuccess && query.data) {
    authState = 'authenticated';
  } else if (query.isError) {
    authState = isClientError(query.error) ? 'unauthenticated' : 'unavailable';
  } else {
    authState = 'loading';
  }

  return {
    user: query.data ?? null,
    authState,
    isAuthenticated: authState === 'authenticated',
    isPending: query.isPending,
  };
}

export function useLogin() {
  return useMutation({
    mutationFn: (credentials: { email: string; password: string }) => loginUser(credentials),
    onSuccess: ({ user }) => {
      setAuth(user);
    },
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: (credentials: { username: string; email: string; password: string }) => registerUser(credentials),
    onSuccess: ({ user }) => {
      setAuth(user);
    },
  });
}

export function useUpdateUser() {
  return useMutation({
    mutationFn: (user: Partial<User>) => updateUser(user),
    onSuccess: ({ user }) => {
      setCurrentUser(user);
    },
  });
}

export function useLogout() {
  const navigate = useNavigate();
  return () => {
    purgeAuth();
    void navigate('/');
  };
}
