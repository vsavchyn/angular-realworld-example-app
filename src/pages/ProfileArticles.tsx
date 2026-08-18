import { useParams } from 'react-router-dom';
import { ArticleList } from '../components/ArticleList';

export function ProfileArticles() {
  const { username } = useParams();

  if (!username) {
    return null;
  }

  return (
    <ArticleList
      config={{
        type: 'all',
        filters: { author: username },
      }}
      currentPage={1}
    />
  );
}
