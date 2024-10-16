import "~/styles/globals.css";
import { GeistSans } from "geist/font/sans";
import { type Metadata } from "next";
import { Toaster } from "react-hot-toast";
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
        <Providers>
          <Toaster position="bottom-right" />
          <div className="h-full">
            <div className="absolute right-4 top-4 z-10 flex gap-2">
              <Login />
              {session && <Menu />}
            </div>
            <div className="mx-auto h-full grow">{children}</div>
            <div className="fixed bottom-0 z-50 flex h-10 w-full flex-col justify-center bg-dark text-center">
              <span>
                Created by{" "}
                <a href="https://github.com/SlatinskyJ" target="_blank">
                  <b>@SlatinskyJ</b>
                </a>
              </span>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
