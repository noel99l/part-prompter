import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import { query, initDb } from '@/lib/db'

export const { handlers, signIn, signOut, auth } = NextAuth({
  pages: {
    signIn: '/auth/signin',
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== 'google') return false
      await initDb()
      await query(
        `INSERT INTO users (google_id, email) VALUES ($1, $2)
         ON CONFLICT (google_id) DO UPDATE SET email = $2`,
        [account.providerAccountId, user.email]
      )
      return true
    },
    async jwt({ token, trigger, session }) {
      if (token.sub && (trigger === 'signIn' || trigger === 'update' || !('userId' in token))) {
        const result = await query(
          `SELECT id, account_name FROM users WHERE google_id = $1`,
          [token.sub]
        )
        if (result.rows[0]) {
          token.userId = result.rows[0].id
          token.accountName = result.rows[0].account_name
        }
      }
      return token
    },
    async session({ session, token }) {
      session.user.id = token.userId as number
      session.user.accountName = token.accountName as string | null
      return session
    },
  },
})
