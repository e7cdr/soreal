import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export async function POST(request) {
  try {
    const { password } = await request.json();

    const backendRes = await fetch(`${BACKEND_URL}/api/blacklist/persons/access/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (!backendRes.ok) {
      return NextResponse.json(
        { detail: "Invalid password." },
        { status: 403 }
      );
    }

    const response = NextResponse.json({ detail: "Access granted." });

    // Set an HttpOnly cookie so server components can forward it to the backend.
    response.cookies.set("blacklist_access_token", password, {
      httpOnly: true,
      path: "/",
      maxAge: 3600,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return response;
  } catch {
    return NextResponse.json(
      { detail: "Unable to validate password." },
      { status: 500 }
    );
  }
}
