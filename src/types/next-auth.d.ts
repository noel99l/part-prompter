import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: number
      accountName: string | null
    } & DefaultSession['user']
  }
}
