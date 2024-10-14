import logo from "@public/logo.svg";
import mainBackgroundImg from "@public/mainBackground.jpg";

import Image from "next/image";
import { HydrateClient } from "~/trpc/server";

export default async function Home() {
  // const hello = await api.post.hello({ text: "from tRPC" });
  // const session = await getServerAuthSession();

  // void api.post.getLatest.prefetch();

  return (
    <HydrateClient>
      <div className="min-h-full">
        <div className="relative">
          <Image
            src={mainBackgroundImg}
            alt="background"
            priority
            placeholder="blur"
          />
          <div
            className="absolute z-20 rounded-full bg-slate-200 p-8 shadow-2xl"
            style={{ right: "23%", top: "23%", width: "16%" }}
          >
            {/* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment */}
            <Image src={logo} alt="logo" className="w-full" priority />
          </div>
        </div>
        <div
          className="bg-neutral border-dark absolute z-10 h-[55%] w-full border-t-[4px]"
          style={{ top: "45%" }}
        >
          <div className="ml-8 mt-4 w-1/4 border-b-[1px] border-gray-500 p-2 pl-8">
            <span className="text-4xl font-medium">Vítejte!</span>
          </div>
          <div className="w-2/5 p-4">
            <p className="break-normal">
              Jsme cimbálová muzika z&nbsp;okolí Brna. Poprvé jsme se sešli
              v&nbsp;roce 2020 a&nbsp;našim přátelům zahráli v&nbsp;roce 2021.
              Od té doby trénujeme a&nbsp;hraním obohacujeme akce všeho druhu.
            </p>
          </div>
        </div>
      </div>
    </HydrateClient>
  );
}
