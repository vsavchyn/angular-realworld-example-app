import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { useArticle, useDeleteArticle } from '../hooks/useArticles';
import { useAddComment, useComments, useDeleteComment } from '../hooks/useComments';
import { ArticleMeta } from '../components/ArticleMeta';
import { ArticleComment } from '../components/ArticleComment';
import { FavoriteButton } from '../components/FavoriteButton';
import { FollowButton } from '../components/FollowButton';
import { ListErrors } from '../components/ListErrors';
import { Markdown } from '../components/Markdown';
import { defaultImage } from '../utils/image';
import { isApiError } from '../api/client';
import type { Errors } from '../models/errors.model';
import type { Profile } from '../models/profile.model';

export function ArticlePage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const articleQuery = useArticle(slug);
  const commentsQuery = useComments(slug);
  const deleteArticle = useDeleteArticle();
  const addComment = useAddComment(slug ?? '');
  const deleteComment = useDeleteComment(slug ?? '');
  const [commentBody, setCommentBody] = useState('');
  const [commentFormErrors, setCommentFormErrors] = useState<Errors | null>(null);
  const [deleteCommentErrors, setDeleteCommentErrors] = useState<Errors | null>(null);

  const article = articleQuery.data;
  const comments = commentsQuery.data ?? [];
  const canModify = !!user && !!article && user.username === article.author.username;

  const loadErrors: Errors | null = articleQuery.isError
    ? isApiError(articleQuery.error)
      ? articleQuery.error
      : { errors: { error: ['Failed to load article'] } }
    : null;

  async function handleDeleteArticle() {
    if (!article) {
      return;
    }
    await deleteArticle.mutateAsync(article.slug);
    void navigate('/');
  }

  async function handleAddComment(event: FormEvent) {
    event.preventDefault();
    if (!article) {
      return;
    }
    setCommentFormErrors(null);
    try {
      await addComment.mutateAsync(commentBody);
      setCommentBody('');
    } catch (error) {
      if (isApiError(error)) {
        setCommentFormErrors(error);
      }
    }
  }

  async function handleDeleteComment(commentId: string) {
    setDeleteCommentErrors(null);
    try {
      await deleteComment.mutateAsync(commentId);
    } catch (error) {
      if (isApiError(error)) {
        setDeleteCommentErrors(error);
      }
    }
  }

  function handleFollow(_profile: Profile) {
    // Cache update in useToggleFollow covers article.author.following
  }

  const actions = article && (
    <>
      {canModify ? (
        <span>
          <Link className="btn btn-sm btn-outline-secondary" to={`/editor/${article.slug}`}>
            <i className="ion-edit"></i> Edit Article
          </Link>
          <button
            className={
              deleteArticle.isPending ? 'btn btn-sm btn-outline-danger disabled' : 'btn btn-sm btn-outline-danger'
            }
            onClick={() => {
              void handleDeleteArticle();
            }}
            type="button"
          >
            <i className="ion-trash-a"></i> Delete Article
          </button>
        </span>
      ) : (
        <span>
          <FollowButton profile={article.author} onToggle={handleFollow} />
          <FavoriteButton article={article}>
            {article.favorited ? 'Unfavorite' : 'Favorite'} Article
            <span className="counter">({article.favoritesCount})</span>
          </FavoriteButton>
        </span>
      )}
    </>
  );

  return (
    <div className="article-page">
      {loadErrors && (
        <div className="container">
          <div className="row">
            <div className="col-md-12">
              <ListErrors errors={loadErrors} />
            </div>
          </div>
        </div>
      )}
      {article && (
        <>
          <div className="banner">
            <div className="container">
              <h1>{article.title}</h1>
              <ArticleMeta article={article}>{actions}</ArticleMeta>
            </div>
          </div>

          <div className="container page">
            <div className="row article-content">
              <div className="col-md-12">
                <Markdown content={article.body} />
                <ul className="tag-list">
                  {article.tagList.map(tag => (
                    <li key={tag} className="tag-default tag-pill tag-outline">
                      {tag}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <hr />

            <div className="article-actions">
              <ArticleMeta article={article}>{actions}</ArticleMeta>
            </div>

            <div className="row">
              <div className="col-xs-12 col-md-8 offset-md-2">
                {isAuthenticated ? (
                  <>
                    <ListErrors errors={commentFormErrors} />
                    <form className="card comment-form" onSubmit={handleAddComment}>
                      <fieldset disabled={addComment.isPending}>
                        <div className="card-block">
                          <textarea
                            className="form-control"
                            placeholder="Write a comment..."
                            rows={3}
                            value={commentBody}
                            onChange={event => setCommentBody(event.target.value)}
                          />
                        </div>
                        <div className="card-footer">
                          <img src={defaultImage(user?.image)} className="comment-author-img" alt="" />
                          <button className="btn btn-sm btn-primary" type="submit">
                            Post Comment
                          </button>
                        </div>
                      </fieldset>
                    </form>
                  </>
                ) : (
                  <div>
                    <Link to="/login">Sign in</Link> or <Link to="/register">sign up</Link> to add comments on this
                    article.
                  </div>
                )}

                <ListErrors errors={deleteCommentErrors} />

                {comments.map(comment => (
                  <ArticleComment
                    key={comment.id}
                    comment={comment}
                    onDelete={() => {
                      void handleDeleteComment(comment.id);
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
