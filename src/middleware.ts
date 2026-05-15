import { auth } from '@/auth.edge'
import { NextResponse } from 'next/server'

export default auth((req) => {
  if (!req.auth) {
    const signInUrl = new URL('/auth/signin', req.url)
    signInUrl.searchParams.set('callbackUrl', req.url)
    return NextResponse.redirect(signInUrl)
  }
  return NextResponse.next()
})

export const config = {
  matcher: ['/admin', '/admin/:path*'],
}
