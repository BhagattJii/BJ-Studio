import { type NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/ping")) {
    return new Response("pong", { status: 200 });
  }
  return NextResponse.next();
}
