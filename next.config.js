/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: '/nexus-cine',
  assetPrefix: '/nexus-cine/',
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
