import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ArticleListConfig } from '../models/article-list-config.model';
import { useArticles } from '../hooks/useArticles';
import { ArticlePreview } from './ArticlePreview';

const LIMIT = 10;

export function ArticleList({
  config,
  currentPage,
  isFollowingFeed = false,
  onPageChange,
}: {
  config: ArticleListConfig;
  currentPage: number;
  isFollowingFeed?: boolean;
  onPageChange?: (page: number) => void;
}) {
  const [page, setPage] = useState(currentPage);
  const configKey = JSON.stringify(config);

  useEffect(() => {
    setPage(currentPage);
  }, [configKey, currentPage]);

  const { data, isPending, isError } = useArticles(config, page, LIMIT);
  const articles = isError ? [] : (data?.articles ?? []);
  const articlesCount = isError ? 0 : (data?.articlesCount ?? 0);
  const totalPages = Array.from({ length: Math.ceil(articlesCount / LIMIT) }, (_, index) => index + 1);

  function setPageTo(pageNumber: number) {
    if (pageNumber !== page) {
      setPage(pageNumber);
      onPageChange?.(pageNumber);
    }
  }

  if (isPending) {
    return <div className="article-preview">Loading articles...</div>;
  }

  return (
    <>
      {articles.length === 0 ? (
        <div className="article-preview empty-feed-message">
          {isFollowingFeed ? (
            <>
              Your feed is empty. Follow some users to see their articles here, or check out the{' '}
              <Link to="/">Global Feed</Link>!
            </>
          ) : (
            <>No articles are here... yet.</>
          )}
        </div>
      ) : (
        articles.map(article => <ArticlePreview key={article.slug} article={article} />)
      )}

      <nav>
        <ul className="pagination">
          {totalPages.map(pageNumber => (
            <li key={pageNumber} className={pageNumber === page ? 'page-item active' : 'page-item'}>
              <button className="page-link" type="button" onClick={() => setPageTo(pageNumber)}>
                {pageNumber}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
