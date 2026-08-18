import { useParams } from 'react-router-dom';
import { ArticleList } from '../components/ArticleList';

export function ProfileFavorites() {
  const { username } = useParams();

  if (!username) {
    return null;
  }

  return (
    <ArticleList
      config={{
        type: 'all',
        filters: { favorited: username },
      }}
      currentPage={1}
    />
  );
}
