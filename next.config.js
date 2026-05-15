/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['pg'],
  eslint: {
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig
