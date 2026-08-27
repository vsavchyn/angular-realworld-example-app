/**
 * JWT storage — same contract as Angular JwtService.
 * Uses localStorage['jwtToken'] so e2e can inject tokens via localStorage.setItem.
 */
export function getToken(): string {
  return window.localStorage['jwtToken'];
}

export function saveToken(token: string): void {
  window.localStorage['jwtToken'] = token;
}

export function destroyToken(): void {
  window.localStorage.removeItem('jwtToken');
}

export function hasToken(): boolean {
  const token = getToken();
  return token != null && token !== '';
}
