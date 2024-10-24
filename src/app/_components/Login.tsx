import Link from "next/link";
import React from "react";
import { getServerAuthSession } from "~/server/auth";

export default async function Login() {
  const session = await getServerAuthSession();

  return (
    <Link
      href={session ? "/api/auth/signout" : "/api/auth/signin"}
      className="rounded-full bg-accent/70 px-6 py-2 font-bold leading-[24px] no-underline transition hover:bg-accent/100"
    >
      {session ? "Odhlásit" : "Přihlásit"}
    </Link>
  );
}
