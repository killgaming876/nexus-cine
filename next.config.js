/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",

  basePath: "/nexus-cine",

  assetPrefix: "/nexus-cine/",

  images: {
    unoptimized: true,
  },

  trailingSlash: true,
};

module.exports = nextConfig;
