'use client';

const BASE_PATH = '/nexus-cine';

export function assetPath(path: string) {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${BASE_PATH}${cleanPath}`;
}
