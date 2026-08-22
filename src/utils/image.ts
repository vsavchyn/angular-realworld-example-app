const DEFAULT_AVATAR = '/assets/default-avatar.svg';

function isAllowedImageUrl(value: string): boolean {
  if (value.startsWith('/') && !value.startsWith('//')) {
    return true;
  }

  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function defaultImage(image: string | null | undefined): string {
  if (!image) {
    return DEFAULT_AVATAR;
  }

  const trimmed = image.trim();
  if (!trimmed || !isAllowedImageUrl(trimmed)) {
    return DEFAULT_AVATAR;
  }

  return trimmed;
}

export function formatLongDate(value: string): string {
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
