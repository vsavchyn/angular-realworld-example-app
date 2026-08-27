import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { Article } from '../models/article.model';
import { useAuth } from '../auth/useAuth';
import { useToggleFavorite } from '../hooks/useArticles';

export function FavoriteButton({
  article,
  onToggle,
  children,
  className,
}: {
  article: Article;
  onToggle?: (favorited: boolean) => void;
  children?: ReactNode;
  className?: string;
}) {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const toggleFavorite = useToggleFavorite();

  function handleClick() {
    if (!isAuthenticated) {
      void navigate('/register');
      return;
    }

    toggleFavorite.mutate(
      { slug: article.slug, favorited: article.favorited },
      {
        onSuccess: ({ favorited }) => {
          onToggle?.(favorited);
        },
      },
    );
  }

  const classes = [
    'btn',
    'btn-sm',
    className,
    toggleFavorite.isPending ? 'disabled' : '',
    article.favorited ? 'btn-primary' : 'btn-outline-primary',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button className={classes} onClick={handleClick} type="button" disabled={toggleFavorite.isPending}>
      <i className="ion-heart"></i> {children}
    </button>
  );
}
