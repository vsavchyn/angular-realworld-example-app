import { Link } from 'react-router-dom';
import type { Article } from '../models/article.model';
import { defaultImage, formatLongDate } from '../utils/image';
import type { ReactNode } from 'react';

export function ArticleMeta({ article, children }: { article: Article; children?: ReactNode }) {
  return (
    <div className="article-meta">
      <Link to={`/profile/${article.author.username}`}>
        <img src={defaultImage(article.author.image)} alt="" />
      </Link>
      <div className="info">
        <Link className="author" to={`/profile/${article.author.username}`}>
          {article.author.username}
        </Link>
        <span className="date">{formatLongDate(article.createdAt)}</span>
      </div>
      {children}
    </div>
  );
}
