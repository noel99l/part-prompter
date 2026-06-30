import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'

export const { auth } = NextAuth({
  providers: [Google],
  callbacks: {
    async jwt({ token }) {
      // メインのauth.tsで書き込まれたaccountNameをそのまま引き継ぐ
      return token
    },
    async session({ session, token }) {
      session.user.accountName = (token.accountName as string | null) ?? null
      session.user.id = token.userId ? String(token.userId) : ''
      return session
    },
  },
})
