import { ARTICLES, FEATURED_SLUG } from './fixtures/browse-feed';
import type { PageName } from './lab-snapshot';

export type LabPage = {
  name: PageName;
  path: string;
  ready: { selector: string; text: string };
};

export const LAB_PAGES: readonly LabPage[] = [
  {
    name: 'home',
    path: '/',
    ready: { selector: '.article-preview .preview-link h1', text: ARTICLES[0].title },
  },
  {
    name: 'login',
    path: '/login',
    ready: { selector: '.auth-page h1', text: 'Sign in' },
  },
  {
    name: 'article',
    path: `/article/${FEATURED_SLUG}`,
    ready: { selector: '.article-page h1', text: ARTICLES[0].title },
  },
];
