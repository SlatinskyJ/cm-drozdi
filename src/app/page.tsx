import logo from "@public/logo.svg";
import mainBackgroundImg from "@public/mainBackground.jpg";

import Image from "next/image";
import EventCalendar from "~/app/_components/EventCalendar";
import RequestEvent from "~/app/_components/RequestEvent";
import { HydrateClient } from "~/trpc/server";

export default async function Home() {
  return (
    <HydrateClient>
      <div className="min-h-full bg-background">
        <div className="relative">
          <Image src={mainBackgroundImg} alt="background" placeholder="blur" />
          <div
            className="absolute z-20 max-w-[500px] rounded-full bg-slate-200 p-[2%] shadow-2xl"
            style={{ right: "23%", top: "23%", width: "16%" }}
          >
            {/* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment */}
            <Image src={logo} alt="logo" className="w-full" />
          </div>
        </div>
        <div
          className="absolute z-10 flex h-2/5 w-full justify-center border-t-[4px] border-dark bg-background"
          style={{ top: "45%" }}
        >
          <div className="relative flex min-h-[95%] w-full max-w-[1500px]">
            <div className="m-10 mt-7">
              <EventCalendar />
            </div>
            <div>
              <div className="ml-6 mt-4 w-2/5 border-b-[1px] border-gray-500 p-2 pl-8">
                <span className="text-4xl font-medium">Vítejte!</span>
              </div>
              <div className="w-1/2 break-normal p-4">
                <p>
                  Jsme cimbálová muzika z&nbsp;okolí Brna. Poprvé jsme se sešli
                  v&nbsp;roce 2020 a&nbsp;našim přátelům zahráli v&nbsp;roce
                  2021. Od té doby trénujeme a&nbsp;hraním obohacujeme akce
                  všeho druhu zejména lidovou hudbou, ale na&nbsp;přání
                  zahrajeme téměř cokoliv.
                </p>
                <p>
                  Naši muziku tvoří: Kuba&nbsp;
                  <span className="text-gray-600/50">(housle)</span>, Adam&nbsp;
                  <span className="text-gray-600/50">(housle)</span>, Petr&nbsp;
                  <span className="text-gray-600/50">(flétny)</span>, Aleš&nbsp;
                  <span className="text-gray-600/50">(viola)</span>, Mário&nbsp;
                  <span className="text-gray-600/50">(viola)</span>, Míša&nbsp;
                  <span className="text-gray-600/50">(basa)</span>, Patrik&nbsp;
                  <span className="text-gray-600/50">(cimbál)</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <RequestEvent />
    </HydrateClient>
  );
}
