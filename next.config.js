/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['pg'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    })
    return config
  },
  async redirects() {
    return [
      { source: '/prompter', destination: '/songs', permanent: true },
      { source: '/prompter/:songId/detail', destination: '/songs/:songId', permanent: true },
      { source: '/prompter/:songId', destination: '/songs/:songId/prompter', permanent: true },
      { source: '/prompter/playlist/:id', destination: '/playlists/:id/prompter', permanent: true },
      { source: '/admin/songs', destination: '/manage/songs', permanent: true },
      { source: '/admin/playlists', destination: '/manage/playlists', permanent: true },
      { source: '/admin/playlists/:id', destination: '/manage/playlists/:id', permanent: true },
      { source: '/admin/settings', destination: '/manage/settings', permanent: true },
      { source: '/admin/:songId', destination: '/manage/songs/:songId', permanent: true },
    ]
  },
}

module.exports = nextConfig
