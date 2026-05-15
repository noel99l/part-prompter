import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      accountName: string | null
    } & DefaultSession['user']
  }
}
