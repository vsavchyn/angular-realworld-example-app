const DEFAULT_AVATAR = '/assets/default-avatar.svg';

const UNSAFE_PROTOCOLS = /^(javascript|data|vbscript):/i;

export function defaultImage(image: string | null | undefined): string {
  if (!image) {
    return DEFAULT_AVATAR;
  }
  if (UNSAFE_PROTOCOLS.test(image.trim())) {
    return DEFAULT_AVATAR;
  }
  return image;
}

export function formatLongDate(value: string): string {
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
