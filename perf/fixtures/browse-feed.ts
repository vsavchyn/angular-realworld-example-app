export interface FixtureProfile {
  username: string;
  bio: string | null;
  image: string | null;
  following: boolean;
}

export interface FixtureArticle {
  slug: string;
  title: string;
  description: string;
  body: string;
  tagList: string[];
  createdAt: string;
  updatedAt: string;
  favorited: boolean;
  favoritesCount: number;
  author: FixtureProfile;
}

export interface FixtureComment {
  id: string;
  body: string;
  createdAt: string;
  author: FixtureProfile;
}

export interface BrowseFeedResult {
  status: number;
  body: unknown;
}

const AUTHORS: FixtureProfile[] = [
  { username: 'jake', bio: 'I work at statefarm', image: null, following: false },
  { username: 'jon', bio: null, image: null, following: false },
  { username: 'alice', bio: 'Writes about the web', image: null, following: false },
];

export const TAGS = [
  'react',
  'performance',
  'realworld',
  'javascript',
  'testing',
  'markdown',
  'csp',
  'k6',
  'playwright',
  'vite',
];

const FEATURED_BODY = `# How to build web apps that scale

Conduit is a **RealWorld** example. This body is intentionally a bit long so the article
page exercises markdown parsing and HTML sanitization — the CPU hotspot on the detail view.

## Why the list omits \`body\`

The RealWorld spec dropped \`article.body\` from list payloads so feeds stay cheap:

- Home / global feed is the common path
- Detail views still include markdown
- Comments load in parallel with the article

\`\`\`ts
export const API_BASE = import.meta.env.VITE_API_BASE ?? 'https://api.realworld.show/api';
\`\`\`

Visit [RealWorld](https://realworld.show) for the spec.

> Pagination keeps the global feed cheap. Most sessions never write.

1. Fetch tags
2. Fetch the feed
3. Open an article
4. Think, then maybe paginate
`;

const TITLES = [
  'How to build web apps that scale',
  'A comparison of React and Angular',
  'Why lists should omit article bodies',
  'Introduction to Core Web Vitals',
  'Pagination patterns for content feeds',
  'Markdown rendering on the client',
  'Designing a medium clone',
  'Tags, feeds, and discovery',
  'Caching JSON APIs in the browser',
  'Optimistic UI for favorites',
  'Session isolation in demo backends',
  'When to use a protocol load test',
  'Smoke vs load vs soak',
  'Measuring LCP in a single-page app',
  'Layout shift from webfonts',
  'Total blocking time and markdown',
  'Bundling React for production',
  'CSP connect-src and third-party APIs',
  'Local mocks for ethical load tests',
  'Think time in virtual user scripts',
  'Read-heavy traffic on news sites',
  'Comments as a parallel request',
  'Fixture data that looks real',
  'Keeping k6 thresholds honest',
  'Preview servers vs the Vite dev server',
  'Why slowMo ruins performance tests',
  'Anonymous browsing as the common path',
  'Encoding slugs in REST paths',
  'CORS for a laptop mock API',
  'Documenting profiles not one giant test',
];

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function isoDaysAgo(days: number): string {
  const date = new Date('2026-08-01T12:00:00.000Z');
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString();
}

export const ARTICLES: FixtureArticle[] = TITLES.map((title, index) => {
  const createdAt = isoDaysAgo(index);
  return {
    slug: slugify(title),
    title,
    description: `Thoughts on ${title.toLowerCase()}.`,
    body: index === 0 ? FEATURED_BODY : `## ${title}\n\nA short note for the article detail view.\n`,
    tagList: [TAGS[index % TAGS.length], TAGS[(index + 3) % TAGS.length]],
    createdAt,
    updatedAt: createdAt,
    favorited: false,
    favoritesCount: (index * 3) % 17,
    author: AUTHORS[index % AUTHORS.length],
  };
});

export const FEATURED_SLUG = ARTICLES[0].slug;

const COMMENTS_BY_SLUG: Record<string, FixtureComment[]> = {
  [FEATURED_SLUG]: [
    {
      id: '1',
      body: 'This matches how a news site actually gets used.',
      createdAt: isoDaysAgo(0),
      author: AUTHORS[1],
    },
    {
      id: '2',
      body: 'Omitting body from the list payload is such a simple win.',
      createdAt: isoDaysAgo(1),
      author: AUTHORS[2],
    },
    {
      id: '3',
      body: 'The markdown path is the one that burns CPU.',
      createdAt: isoDaysAgo(2),
      author: AUTHORS[0],
    },
  ],
  [ARTICLES[4].slug]: [
    {
      id: '4',
      body: 'Offset pagination is enough for this feed.',
      createdAt: isoDaysAgo(4),
      author: AUTHORS[2],
    },
  ],
  [ARTICLES[11].slug]: [
    {
      id: '5',
      body: 'Protocol VUs are so much cheaper than real browsers.',
      createdAt: isoDaysAgo(11),
      author: AUTHORS[0],
    },
  ],
};

export function listArticles(limit = 20, offset = 0, tag?: string | null) {
  const filtered = tag ? ARTICLES.filter(article => article.tagList.includes(tag)) : ARTICLES;
  const articles = filtered.slice(offset, offset + limit).map(({ body: _body, ...rest }) => rest);
  return { articles, articlesCount: filtered.length };
}

export function getArticleBySlug(slug: string): FixtureArticle | undefined {
  return ARTICLES.find(article => article.slug === slug);
}

export function getCommentsBySlug(slug: string): FixtureComment[] {
  return COMMENTS_BY_SLUG[slug] ?? [];
}

function notFound(entity: string): BrowseFeedResult {
  return { status: 404, body: { errors: { [entity]: ['not found'] } } };
}

export function browseFeedResponse(method: string, pathname: string, searchParams: URLSearchParams): BrowseFeedResult {
  if (method !== 'GET' && method !== 'HEAD') {
    return { status: 405, body: { errors: { method: ['not allowed'] } } };
  }

  const normalized = (pathname.replace(/\/+$/, '') || '/').replace(/^\/api(?=\/|$)/, '') || '/';

  if (normalized === '/tags') {
    return { status: 200, body: { tags: TAGS } };
  }

  const commentsMatch = normalized.match(/^\/articles\/([^/]+)\/comments$/);
  if (commentsMatch) {
    const slug = decodeURIComponent(commentsMatch[1]);
    if (!getArticleBySlug(slug)) {
      return notFound('article');
    }
    return { status: 200, body: { comments: getCommentsBySlug(slug) } };
  }

  const articleMatch = normalized.match(/^\/articles\/([^/]+)$/);
  if (articleMatch) {
    const slug = decodeURIComponent(articleMatch[1]);
    const article = getArticleBySlug(slug);
    if (!article) {
      return notFound('article');
    }
    return { status: 200, body: { article } };
  }

  if (normalized === '/articles') {
    const limit = Number(searchParams.get('limit') ?? 20);
    const offset = Number(searchParams.get('offset') ?? 0);
    const tag = searchParams.get('tag');
    return {
      status: 200,
      body: listArticles(Number.isFinite(limit) ? limit : 20, Number.isFinite(offset) ? offset : 0, tag),
    };
  }

  return notFound('path');
}
