import http from 'k6/http';
import { check, sleep } from 'k6';

const API_BASE = __ENV.API_BASE || 'http://localhost:8081/api';
const PROFILE = __ENV.PROFILE || 'smoke';

if (String(API_BASE).includes('api.realworld.show')) {
  throw new Error('Refusing to load-test api.realworld.show');
}

const profiles = {
  smoke: {
    vus: 1,
    duration: '30s',
  },
  load: {
    stages: [
      { duration: '30s', target: 10 },
      { duration: '1m', target: 10 },
      { duration: '30s', target: 0 },
    ],
  },
};

const selected = profiles[PROFILE] || profiles.smoke;

export const options = {
  ...selected,
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<200'],
    checks: ['rate>0.99'],
  },
};

function json(response, path) {
  try {
    return response.json(path);
  } catch {
    return undefined;
  }
}

export default function browseFeed() {
  const tagsRes = http.get(`${API_BASE}/tags`);
  check(tagsRes, {
    'tags status 200': r => r.status === 200,
    'tags is an array': r => Array.isArray(json(r, 'tags')),
  });

  const listRes = http.get(`${API_BASE}/articles?limit=10&offset=0`);
  const articles = json(listRes, 'articles') || [];
  check(listRes, {
    'feed status 200': r => r.status === 200,
    'feed has articles': () => Array.isArray(articles) && articles.length > 0,
  });

  if (Math.random() < 0.2 && articles.length > 0) {
    const slug = encodeURIComponent(articles[0].slug);
    const batch = http.batch([
      ['GET', `${API_BASE}/articles/${slug}`],
      ['GET', `${API_BASE}/articles/${slug}/comments`],
    ]);
    check(batch[0], {
      'article status 200': r => r.status === 200,
      'article has body': r => typeof json(r, 'article.body') === 'string',
    });
    check(batch[1], {
      'comments status 200': r => r.status === 200,
      'comments is an array': r => Array.isArray(json(r, 'comments')),
    });
  }

  sleep(1 + Math.random());

  if (Math.random() < 0.2) {
    const pageRes = http.get(`${API_BASE}/articles?limit=10&offset=10`);
    check(pageRes, {
      'page 2 status 200': r => r.status === 200,
      'page 2 has articles': r => (json(r, 'articles') || []).length > 0,
    });
  }
}
