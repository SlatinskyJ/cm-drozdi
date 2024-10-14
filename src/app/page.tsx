import logo from "@public/logo.svg";
import mainBackgroundImg from "@public/mainBackground.jpg";
import Text from "antd/es/typography/Text";
import Title from "antd/es/typography/Title";

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
          <div className="ml-8 mt-4 w-1/4 border-b-[1px] border-gray-500 pl-8">
            <Title>Vítejte!</Title>
          </div>
          <div className="p-2">
            <Text>
              Jsme cimbálová muzika z okolí Brna. Poprvé jsme se sešli v roce
              2020 a našim přátelům zahráli v roce 2021. Od té doby trénujeme a
              hraním obohacujeme akce všeho druhu.
            </Text>
          </div>
        </div>
      </div>
    </HydrateClient>
  );
}
