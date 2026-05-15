import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') || ''
  const res = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(q)}`, {
    headers: { 'User-Agent': 'part-prompter/1.0' },
  })
  const data = await res.json()
  return NextResponse.json(data)
}
