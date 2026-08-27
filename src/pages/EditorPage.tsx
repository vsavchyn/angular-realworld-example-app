import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { ListErrors } from '../components/ListErrors';
import { useAuth } from '../auth/useAuth';
import { useArticle, useCreateArticle, useUpdateArticle } from '../hooks/useArticles';
import { isApiError } from '../api/client';
import type { Errors } from '../models/errors.model';

interface ArticleFormValues {
  title: string;
  description: string;
  body: string;
}

export function EditorPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const articleQuery = useArticle(slug);
  const createArticle = useCreateArticle();
  const updateArticle = useUpdateArticle();
  const [tagList, setTagList] = useState<string[]>([]);
  const [tagField, setTagField] = useState('');
  const [errors, setErrors] = useState<Errors | null>(null);

  const { register, handleSubmit, reset, getValues, formState } = useForm<ArticleFormValues>({
    defaultValues: { title: '', description: '', body: '' },
  });

  useEffect(() => {
    const article = articleQuery.data;
    if (!slug || !article || !user) {
      return;
    }
    if (user.username !== article.author.username) {
      void navigate('/');
      return;
    }
    setTagList(article.tagList);
    reset({
      title: article.title,
      description: article.description,
      body: article.body,
    });
  }, [articleQuery.data, navigate, reset, slug, user]);

  function nextTagList() {
    const tag = tagField;
    let tags = tagList;
    if (tag != null && tag.trim() !== '' && tags.indexOf(tag) < 0) {
      tags = [...tags, tag];
    }
    setTagList(tags);
    setTagField('');
    return tags;
  }

  function addTag() {
    nextTagList();
  }

  function removeTag(tagName: string) {
    setTagList(tags => tags.filter(tag => tag !== tagName));
  }

  function onTagKeyUp(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      addTag();
    }
  }

  async function onSubmit() {
    const articleData = {
      ...getValues(),
      tagList: nextTagList(),
    };

    try {
      const article = slug
        ? await updateArticle.mutateAsync({ ...articleData, slug })
        : await createArticle.mutateAsync(articleData);
      void navigate(`/article/${article.slug}`);
    } catch (error) {
      if (isApiError(error)) {
        setErrors(error);
      } else {
        setErrors({ errors: { error: ['Something went wrong'] } });
      }
    }
  }

  const submitting = formState.isSubmitting || createArticle.isPending || updateArticle.isPending;

  return (
    <div className="editor-page">
      <div className="container page">
        <div className="row">
          <div className="col-md-10 offset-md-1 col-xs-12">
            <ListErrors errors={errors} />
            <form
              onSubmit={(event: FormEvent) => {
                event.preventDefault();
              }}
            >
              <fieldset disabled={submitting}>
                <fieldset className="form-group">
                  <input
                    className="form-control form-control-lg"
                    {...register('title')}
                    name="title"
                    type="text"
                    placeholder="Article Title"
                  />
                </fieldset>
                <fieldset className="form-group">
                  <input
                    className="form-control"
                    {...register('description')}
                    name="description"
                    type="text"
                    placeholder="What's this article about?"
                  />
                </fieldset>
                <fieldset className="form-group">
                  <textarea
                    className="form-control"
                    {...register('body')}
                    name="body"
                    rows={8}
                    placeholder="Write your article (in markdown)"
                  />
                </fieldset>
                <fieldset className="form-group">
                  <input
                    className="form-control"
                    type="text"
                    placeholder="Enter tags"
                    value={tagField}
                    onChange={event => setTagField(event.target.value)}
                    onKeyUp={onTagKeyUp}
                  />
                  <div className="tag-list">
                    {tagList.map(tag => (
                      <span className="tag-default tag-pill" key={tag}>
                        <i className="ion-close-round" onClick={() => removeTag(tag)}></i>
                        {tag}
                      </span>
                    ))}
                  </div>
                </fieldset>
                <button
                  className="btn btn-lg pull-xs-right btn-primary"
                  type="button"
                  onClick={() => {
                    void handleSubmit(onSubmit)();
                  }}
                >
                  Publish Article
                </button>
              </fieldset>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
