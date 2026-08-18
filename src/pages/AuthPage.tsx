import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { ListErrors } from '../components/ListErrors';
import { useLogin, useRegister } from '../auth/useAuth';
import { isApiError } from '../api/client';
import type { Errors } from '../models/errors.model';

interface AuthFormValues {
  username?: string;
  email: string;
  password: string;
}

export function AuthPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const authType = location.pathname.endsWith('/register') ? 'register' : 'login';
  const title = authType === 'login' ? 'Sign in' : 'Sign up';
  const [errors, setErrors] = useState<Errors>({ errors: {} });
  const login = useLogin();
  const registerUser = useRegister();

  const {
    register,
    handleSubmit,
    formState: { isValid, isSubmitting },
  } = useForm<AuthFormValues>({
    mode: 'onChange',
    defaultValues: authType === 'register' ? { username: '', email: '', password: '' } : { email: '', password: '' },
  });

  async function onSubmit(values: AuthFormValues) {
    setErrors({ errors: {} });
    try {
      if (authType === 'login') {
        await login.mutateAsync({ email: values.email, password: values.password });
      } else {
        await registerUser.mutateAsync({
          username: values.username ?? '',
          email: values.email,
          password: values.password,
        });
      }
      void navigate('/');
    } catch (error) {
      if (isApiError(error)) {
        setErrors(error);
      } else {
        setErrors({ errors: { error: ['Something went wrong'] } });
      }
    }
  }

  const submitting = isSubmitting || login.isPending || registerUser.isPending;

  return (
    <div className="auth-page">
      <div className="container page">
        <div className="row">
          <div className="col-md-6 offset-md-3 col-xs-12">
            <h1 className="text-xs-center">{title}</h1>
            <p className="text-xs-center">
              {authType === 'register' ? (
                <Link to="/login">Have an account?</Link>
              ) : (
                <Link to="/register">Need an account?</Link>
              )}
            </p>
            <ListErrors errors={errors} />
            <form key={authType} onSubmit={handleSubmit(onSubmit)}>
              <fieldset disabled={submitting}>
                {authType === 'register' && (
                  <fieldset className="form-group">
                    <input
                      {...register('username', { required: true })}
                      name="username"
                      placeholder="Username"
                      className="form-control form-control-lg"
                      type="text"
                    />
                  </fieldset>
                )}
                <fieldset className="form-group">
                  <input
                    {...register('email', { required: true })}
                    name="email"
                    placeholder="Email"
                    className="form-control form-control-lg"
                    type="text"
                  />
                </fieldset>
                <fieldset className="form-group">
                  <input
                    {...register('password', { required: true })}
                    name="password"
                    placeholder="Password"
                    className="form-control form-control-lg"
                    type="password"
                  />
                </fieldset>
                <button className="btn btn-lg btn-primary pull-xs-right" disabled={!isValid} type="submit">
                  {title}
                </button>
              </fieldset>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
