import "~/styles/globals.css";
import { GeistSans } from "geist/font/sans";
import type { Viewport } from "next";
import { type Metadata } from "next";

import { Pacifico } from "next/font/google";
import { Toaster } from "react-hot-toast";
import Login from "~/app/_components/Login";
import Providers from "~/app/_components/Providers";
import { getServerAuthSession } from "~/server/auth";
import Menu from "./_components/Menu";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "CM Drozdi",
  description: "CM Drozdi",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const pacifico = Pacifico({
  weight: "400",
  variable: "--font-pacifico",
  subsets: ["latin", "latin-ext"],
});

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getServerAuthSession();

  return (
    <html
      lang="cs"
      className={`${GeistSans.variable} ${pacifico.className} h-full bg-background`}
    >
      <body className="h-full">
        <Providers>
          <Toaster position="bottom-right" />
          <div className="h-full">
            <div className="absolute right-4 top-2 z-10 flex gap-2 align-bottom">
              <Login />
              {session && <Menu />}
            </div>
            <div className="mx-auto h-full grow">{children}</div>
            <div className="fixed bottom-0 z-50 flex h-10 w-full flex-col justify-center bg-dark text-center">
              <div>
                <span className="font-sans text-stone-400">
                  Created by&nbsp;
                </span>
                <a
                  href="https://github.com/SlatinskyJ"
                  target="_blank"
                  className="text-default-600"
                >
                  @SlatinskyJ
                </a>
              </div>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
