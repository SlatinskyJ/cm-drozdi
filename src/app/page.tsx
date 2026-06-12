import logo from '@public/logo.svg';
import mainBackgroundImg from '@public/mainBackground.jpg';

import Image from 'next/image';
import EventCalendar from '~/app/events/_components/EventCalendar';
import RequestEvent from '~/app/events/_components/RequestEvent';
import { HydrateClient } from '~/trpc/server';

export default async function Home() {
	return (
		<HydrateClient>
			<div className="h-full lg:overflow-hidden">
				<div className="h-[3.25rem] sm:hidden" />
				<div className="relative border-t-[4px] border-dark sm:border-0">
					<Image
						src={mainBackgroundImg}
						alt="background"
						placeholder="blur"
					/>
					<div className="absolute bottom-[-30%] right-[21%] z-20 w-[20%] rounded-full bg-default-50 p-[2%] shadow-2xl sm:bottom-[-5%] md:bottom-[0%] lg:bottom-[110px] lg:right-[23%] lg:max-w-[200px] lg:p-6 portrait:lg:bottom-[25%]">
						{/* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment */}
						<Image src={logo} alt="logo" className="w-full" />
					</div>
				</div>
				<div className="relative z-10 flex w-full justify-center border-t-[4px] border-dark bg-background md:mb-20 lg:top-[-160px]">
					<div className="relative flex min-h-[95%] w-full max-w-[1500px] flex-col pb-24 md:flex-row-reverse">
						<div>
							<div className="mx-6 mt-5 w-[calc(100%-3rem)] border-b-[1px] border-gray-500/30 pb-3 sm:pb-0">
								<span className="pl-4 text-3xl">Vítejte!</span>
							</div>
							<div className="break-normal p-4 text-lg">
								<p>
									Jsme cimbálová muzika z&nbsp;okolí Brna.
									Poprvé jsme se sešli v&nbsp;roce 2020
									a&nbsp;našim přátelům zahráli v&nbsp;roce
									2021. Od té doby trénujeme a&nbsp;hraním
									obohacujeme akce všeho druhu zejména lidovou
									hudbou, ale na&nbsp;přání zahrajeme téměř
									cokoliv.
								</p>
								<p>
									Naši muziku tvoří: Kuba&nbsp;
									<span className="text-default-600/70">
										(housle)
									</span>
									, Adam&nbsp;
									<span className="text-default-600/70">
										(housle)
									</span>
									, Petr&nbsp;
									<span className="text-default-600/70">
										(flétny)
									</span>
									, Aleš&nbsp;
									<span className="text-default-600/70">
										(viola)
									</span>
									, Mário&nbsp;
									<span className="text-default-600/70">
										(viola)
									</span>
									, Míša&nbsp;
									<span className="text-default-600/70">
										(basa)
									</span>
									, Patrik&nbsp;
									<span className="text-default-600/70">
										(cimbál)
									</span>
								</p>
							</div>
						</div>
						<div className="m-8 mt-5 flex flex-col">
							<EventCalendar />
						</div>
					</div>
				</div>
			</div>
			<RequestEvent />
		</HydrateClient>
	);
}
