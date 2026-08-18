import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { ListErrors } from '../components/ListErrors';
import { useAuth, useLogout, useUpdateUser } from '../auth/useAuth';
import { isApiError } from '../api/client';
import type { Errors } from '../models/errors.model';

interface SettingsFormValues {
  image: string;
  username: string;
  bio: string;
  email: string;
  password: string;
}

export function SettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const logout = useLogout();
  const updateUser = useUpdateUser();
  const [errors, setErrors] = useState<Errors | null>(null);

  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<SettingsFormValues>({
    defaultValues: {
      image: user?.image ?? '',
      username: user?.username ?? '',
      bio: user?.bio ?? '',
      email: user?.email ?? '',
      password: '',
    },
  });

  async function onSubmit(values: SettingsFormValues) {
    const payload: Partial<SettingsFormValues> = { ...values };
    if (!payload.password) {
      delete payload.password;
    }

    try {
      const { user: next } = await updateUser.mutateAsync(payload);
      void navigate(`/profile/${next.username}`);
    } catch (error) {
      if (isApiError(error)) {
        setErrors(error);
      } else {
        setErrors({ errors: { error: ['Something went wrong'] } });
      }
    }
  }

  return (
    <div className="settings-page">
      <div className="container page">
        <div className="row">
          <div className="col-md-6 offset-md-3 col-xs-12">
            <h1 className="text-xs-center">Your Settings</h1>
            <ListErrors errors={errors} />
            <form onSubmit={handleSubmit(onSubmit)}>
              <fieldset disabled={isSubmitting || updateUser.isPending}>
                <fieldset className="form-group">
                  <input
                    className="form-control"
                    type="text"
                    placeholder="URL of profile picture"
                    {...register('image')}
                    name="image"
                  />
                </fieldset>
                <fieldset className="form-group">
                  <input
                    className="form-control form-control-lg"
                    type="text"
                    placeholder="Username"
                    {...register('username')}
                    name="username"
                  />
                </fieldset>
                <fieldset className="form-group">
                  <textarea
                    className="form-control form-control-lg"
                    rows={8}
                    placeholder="Short bio about you"
                    {...register('bio')}
                    name="bio"
                  />
                </fieldset>
                <fieldset className="form-group">
                  <input
                    className="form-control form-control-lg"
                    type="email"
                    placeholder="Email"
                    {...register('email')}
                    name="email"
                  />
                </fieldset>
                <fieldset className="form-group">
                  <input
                    className="form-control form-control-lg"
                    type="password"
                    placeholder="New Password"
                    {...register('password')}
                    name="password"
                  />
                </fieldset>
                <button className="btn btn-lg btn-primary pull-xs-right" type="submit">
                  Update Settings
                </button>
              </fieldset>
            </form>
            <hr />
            <button className="btn btn-outline-danger" type="button" onClick={logout}>
              Or click here to logout.
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
