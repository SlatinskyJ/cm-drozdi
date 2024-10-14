import Link from "next/link";
import React from "react";
import { getServerAuthSession } from "~/server/auth";

export default async function Login() {
  const session = await getServerAuthSession();

  return (
    <Link
      href={session ? "/api/auth/signout" : "/api/auth/signin"}
      className="bg-accent/50 hover:bg-accent/80 rounded-full px-6 py-2 font-bold no-underline transition"
    >
      {session ? "Sign out" : "Sign in"}
    </Link>
  );
}
