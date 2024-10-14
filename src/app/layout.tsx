import "~/styles/globals.css";
import { GeistSans } from "geist/font/sans";
import { type Metadata } from "next";
import Login from "~/app/_components/Login";
import Providers from "~/app/_components/Providers";
import { getServerAuthSession } from "~/server/auth";

import Menu from "./_components/Menu";

export const metadata: Metadata = {
  title: "CM Drozdi",
  description: "CM Drozdi",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getServerAuthSession();

  return (
    <html lang="en" className={`${GeistSans.variable} h-full`}>
      <body className="h-full">
        <div className="min-h-full">
          <div className="absolute right-4 top-6 z-10 flex gap-2">
            <Login />
            {session && <Menu />}
          </div>
          <div className="mx-auto min-h-full grow">
            <Providers>{children}</Providers>
          </div>
          <div className="bg-dark fixed bottom-0 z-50 flex h-10 w-full flex-col justify-center text-center">
            <span>
              Created by <b>@SlatinskyJ</b>
            </span>
          </div>
        </div>
      </body>
    </html>
  );
}
