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
    async jwt({ token, trigger, account }) {
      // Auth.js は OAuth ログインのたびに token.sub へランダムなUUIDを入れる（GoogleのIDではない）。
      // Google側のIDは account.providerAccountId で、ログイン時にしか渡されないのでトークンに控える。
      // 以前は token.sub で users を検索していたため一致せず、userId が一度も入らなかった。
      if (account?.provider === 'google') token.googleId = account.providerAccountId

      if (trigger === 'signIn' || trigger === 'update' || !token.userId) {
        // users テーブルはログイン時（signIn）に必ず用意済みなので、ここでは initDb() を呼ばない。
        // 呼ぶと、コールドスタート時に認証確認のたびにテーブル定義の確認が走って遅くなる。
        const result = typeof token.googleId === 'string'
          ? await query(`SELECT id, account_name FROM users WHERE google_id = $1`, [token.googleId])
          // 修正前からログインしている人のトークンには googleId がないので、メールアドレスで引く
          : token.email
            ? await query(`SELECT id, account_name FROM users WHERE email = $1 ORDER BY id LIMIT 1`, [token.email])
            : null
        if (result?.rows[0]) {
          token.userId = result.rows[0].id
          token.accountName = result.rows[0].account_name
        }
      }
      return token
    },
    async session({ session, token }) {
      session.user.accountName = (token.accountName as string | null) ?? null
      // 未解決のときに文字列 "undefined" にならないよう、空文字にする
      session.user.id = token.userId != null ? String(token.userId) : ''
      return session
    },
  },
})
