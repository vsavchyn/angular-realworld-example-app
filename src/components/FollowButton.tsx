import { useNavigate } from 'react-router-dom';
import type { Profile } from '../models/profile.model';
import { useAuth } from '../auth/useAuth';
import { useToggleFollow } from '../hooks/useProfile';

export function FollowButton({ profile, onToggle }: { profile: Profile; onToggle?: (profile: Profile) => void }) {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const toggleFollow = useToggleFollow();

  function handleClick() {
    if (!isAuthenticated) {
      void navigate('/login');
      return;
    }

    toggleFollow.mutate(
      { username: profile.username, following: profile.following },
      {
        onSuccess: next => {
          onToggle?.(next);
        },
      },
    );
  }

  const classes = [
    'btn',
    'btn-sm',
    'action-btn',
    toggleFollow.isPending ? 'disabled' : '',
    profile.following ? 'btn-secondary' : 'btn-outline-secondary',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button className={classes} onClick={handleClick} type="button" disabled={toggleFollow.isPending}>
      <i className="ion-plus-round"></i>
      &nbsp;
      {profile.following ? 'Unfollow' : 'Follow'} {profile.username}
    </button>
  );
}
