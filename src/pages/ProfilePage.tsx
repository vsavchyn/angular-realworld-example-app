import { Link, NavLink, Outlet, useParams } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { useProfile } from '../hooks/useProfile';
import { FollowButton } from '../components/FollowButton';
import { ListErrors } from '../components/ListErrors';
import { defaultImage } from '../utils/image';
import { isApiError } from '../api/client';
import type { Errors } from '../models/errors.model';

export function ProfilePage() {
  const { username } = useParams();
  const { user } = useAuth();
  const profileQuery = useProfile(username);
  const profile = profileQuery.data;
  const isUser = !!profile && profile.username === user?.username;

  const errors: Errors | null = profileQuery.isError
    ? isApiError(profileQuery.error)
      ? profileQuery.error
      : { errors: { error: ['Failed to load profile'] } }
    : null;

  return (
    <div className="profile-page">
      {errors && (
        <div className="container">
          <div className="row">
            <div className="col-xs-12 col-md-10 offset-md-1">
              <ListErrors errors={errors} />
            </div>
          </div>
        </div>
      )}
      {profile && (
        <>
          <div className="user-info">
            <div className="container">
              <div className="row">
                <div className="col-xs-12 col-md-10 offset-md-1">
                  <img src={defaultImage(profile.image)} className="user-img" alt="" />
                  <h4>{profile.username}</h4>
                  <p>{profile.bio ?? ''}</p>
                  {!isUser && <FollowButton profile={profile} />}
                  {isUser && (
                    <Link to="/settings" className="btn btn-sm btn-outline-secondary action-btn">
                      <i className="ion-gear-a"></i> Edit Profile Settings
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="container">
            <div className="row">
              <div className="col-xs-12 col-md-10 offset-md-1">
                <div className="articles-toggle">
                  <ul className="nav nav-pills outline-active">
                    <li className="nav-item">
                      <NavLink
                        className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
                        to={`/profile/${profile.username}`}
                        end
                      >
                        My Posts
                      </NavLink>
                    </li>
                    <li className="nav-item">
                      <NavLink
                        className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
                        to={`/profile/${profile.username}/favorites`}
                        end
                      >
                        Favorited Posts
                      </NavLink>
                    </li>
                  </ul>
                </div>
                <Outlet />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
