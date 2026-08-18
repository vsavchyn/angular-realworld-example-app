import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { ArticleList } from '../components/ArticleList';
import { useTags } from '../hooks/useTags';
import type { ArticleListConfig } from '../models/article-list-config.model';

export function HomePage() {
  const { isAuthenticated } = useAuth();
  const { tag } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const tagsQuery = useTags();

  const feed = searchParams.get('feed');
  const page = searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : 1;

  if (feed === 'following' && !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  let type = 'all';
  let filters: ArticleListConfig['filters'] = {};
  if (tag) {
    type = 'all';
    filters = { tag };
  } else if (feed === 'following') {
    type = 'feed';
  }

  const listConfig: ArticleListConfig = { type, filters };
  const isFollowingFeed = type === 'feed';
  const tags = tagsQuery.data ?? [];
  const tagsLoaded = !tagsQuery.isPending;

  function onPageChange(nextPage: number) {
    const next = new URLSearchParams();
    if (feed) {
      next.set('feed', feed);
    }
    if (nextPage > 1) {
      next.set('page', String(nextPage));
    }
    setSearchParams(next);
  }

  return (
    <div className="home-page">
      {!isAuthenticated && (
        <div className="banner">
          <div className="container">
            <h1 className="logo-font">
              <img src="/assets/conduit-logo.svg" alt="Conduit" className="banner-logo" />
            </h1>
            <p>
              This is the <a href="https://github.com/realworld-apps/angular-realworld-example-app">React frontend</a>{' '}
              demo from the <a href="https://github.com/realworld-apps/realworld">Realworld</a> project.
              <br />
              This demo is connected to a demo backend that enforces session isolation.
            </p>
          </div>
        </div>
      )}

      <div className="container page">
        <div className="row">
          <div className="col-md-9">
            <div className="feed-toggle">
              <ul className="nav nav-pills outline-active">
                {isAuthenticated && (
                  <li className="nav-item">
                    <Link className={listConfig.type === 'feed' ? 'nav-link active' : 'nav-link'} to="/?feed=following">
                      Your Feed
                    </Link>
                  </li>
                )}
                <li className="nav-item">
                  <Link
                    className={listConfig.type === 'all' && !listConfig.filters.tag ? 'nav-link active' : 'nav-link'}
                    to="/"
                  >
                    Global Feed
                  </Link>
                </li>
                <li className="nav-item" hidden={!listConfig.filters.tag}>
                  <a className="nav-link active">
                    <i className="ion-pound"></i> {listConfig.filters.tag}
                  </a>
                </li>
              </ul>
            </div>

            <ArticleList
              config={listConfig}
              currentPage={page}
              isFollowingFeed={isFollowingFeed}
              onPageChange={onPageChange}
            />
          </div>

          <div className="col-md-3">
            <div className="sidebar">
              <p>Popular Tags</p>
              <div className="tag-list">
                {tags.map(item => (
                  <Link className="tag-default tag-pill" key={item} to={`/tag/${item}`}>
                    {item}
                  </Link>
                ))}
              </div>
              <div hidden={tagsLoaded}>Loading tags...</div>
              <div hidden={!tagsLoaded || tags.length > 0}>No tags are here... yet.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
