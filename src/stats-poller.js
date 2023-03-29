import dotenv from 'dotenv';

dotenv.config();

import { fetchMembersLatest, getSubsession } from './integration.js';
import { auth } from './auth.js';
import { createClient } from 'redis';
import { format } from 'date-fns-tz';

// eslint-disable-next-line no-unused-vars
const getLatestRace = async (cust_id) => {
    const latestRace = await redis.hGetAll(cust_id.toString());
    return latestRace;
};

const postToDiscord = async (instance, race, raceDetails, member) => {
    const safetyFormatter = new Intl.NumberFormat('en-US', {
        signDisplay: 'exceptZero',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
    const formatter = new Intl.NumberFormat('en-US', {
        signDisplay: 'exceptZero',
    });
    const formatLicense = (raceDetails) => {
        if (raceDetails.race.new_license_level <= 4) {
            return `R ${raceDetails.race.new_sub_level / 100.0} (${safetyFormatter.format(
                (raceDetails.race.new_sub_level - raceDetails.race.old_sub_level) / 100.0
            )})`;
        }
        if (raceDetails.race.new_license_level <= 8) {
            return `D ${raceDetails.race.new_sub_level / 100.0} (${safetyFormatter.format(
                (raceDetails.race.new_sub_level - raceDetails.race.old_sub_level) / 100.0
            )})`;
        }
        if (raceDetails.race.new_license_level <= 12) {
            return `C ${raceDetails.race.new_sub_level / 100.0} (${safetyFormatter.format(
                (raceDetails.race.new_sub_level - raceDetails.race.old_sub_level) / 100.0
            )})`;
        }
        if (raceDetails.race.new_license_level <= 16) {
            return `B ${raceDetails.race.new_sub_level / 100.0} (${safetyFormatter.format(
                (raceDetails.race.new_sub_level - raceDetails.race.old_sub_level) / 100.0
            )})`;
        }
        if (raceDetails.race.new_license_level <= 20) {
            return `A ${raceDetails.race.new_sub_level / 100.0} (${safetyFormatter.format(
                (raceDetails.race.new_sub_level - raceDetails.race.old_sub_level) / 100.0
            )})`;
        }
    };
    let bestLap = new Date(raceDetails.race.best_lap_time / 10);
    let averageLap = new Date(raceDetails.race.average_lap / 10);
    let qualLap = raceDetails.qualifying ? new Date(raceDetails.qualifying.best_qual_lap_time / 10) : undefined;

    let poleposition = new Date(raceDetails.poleposition.best_qual_lap_time / 10);
    let fastestLap = new Date(raceDetails.fastestLap.best_lap_time / 10);
    let bestAverage = new Date(raceDetails.winner.average_lap / 10);

    const embeds = [
        {
            title: `${race.series_short_name} kjørt på ${race.track.track_name}`,
            url: `https://members.iracing.com/membersite/member/EventResult.do?subsessionid=${race.subsession_id}&custid=${member.cust_id}`,
            fields: [
                {
                    name: 'Fører',
                    value: `**${member.display_name}**`,
                    inline: true,
                },
                {
                    name: 'Bil',
                    value: race.car_name,
                    inline: true,
                },
                {
                    name: 'Klasse',
                    value: race.car_class_short_name,
                    inline: true,
                },
                {
                    name: 'SOF',
                    value: race.event_strength_of_field,
                    inline: true,
                },
                {
                    name: 'Start',
                    value: race.starting_position_in_class,
                    inline: true,
                },
                {
                    name: 'Plassering',
                    value: race.finish_position_in_class,
                    inline: true,
                },

                {
                    name: 'Runder kjørt',
                    value: race.laps_complete,
                    inline: true,
                },
                {
                    name: 'Runder ledet',
                    value: race.laps_led,
                    inline: true,
                },
                {
                    name: 'Incs',
                    value: race.incidents,
                    inline: true,
                },
                {
                    name: 'Beste rundetid',
                    value: `${format(bestLap, 'mm:ss.SSS')}`,
                    inline: true,
                },
                {
                    name: 'Gjennomsnittlig',
                    value: `${format(averageLap, 'mm:ss.SSS')}`,
                    inline: true,
                },
                {
                    name: 'Kvalifisering',
                    value: `${qualLap ? format(qualLap, 'mm:ss.SSS') : 'Ingen tid'}`,
                    inline: true,
                },
                { name: '', value: '' },
                {
                    name: 'Pole position',
                    value: raceDetails.poleposition.display_name,
                    inline: true,
                },
                {
                    name: 'Tid',
                    value: `${format(poleposition, 'mm:ss.SSS')}`,
                    inline: true,
                },
                { name: '', value: '' },
                {
                    name: 'Vinner',
                    value: raceDetails.winner.display_name,
                    inline: true,
                },
                {
                    name: 'Gjennomsnittlig tid',
                    value: `${format(bestAverage, 'mm:ss.SSS')}`,
                    inline: true,
                },
                { name: '', value: '' },
                {
                    name: 'Raskeste rundetid',
                    value: raceDetails.fastestLap.display_name,
                    inline: true,
                },
                {
                    name: 'Tid',
                    value: `${format(fastestLap, 'mm:ss.SSS')}`,
                    inline: true,
                },
                { name: 'Resultat', value: '' },
                {
                    name: 'Lisens',
                    value: `${formatLicense(raceDetails)}`,
                    inline: true,
                },
                {
                    name: 'iRating',
                    value: `${raceDetails.race.newi_rating} (${formatter.format(
                        raceDetails.race.newi_rating - raceDetails.race.oldi_rating
                    )})`,
                    inline: true,
                },
            ],
            footer: {
                text: `Startet: ${format(new Date(race.start_time), 'dd.MM.yyyy, HH:mm', {
                    timeZone: 'Europe/Berlin',
                })}`,
            },
        },
    ];

    if (process.env.DISCORD_WEBHOOK) {
        await instance.post(process.env.DISCORD_WEBHOOK, {
            username: 'SloWmo racebot',
            title: 'SloWmo has raced',
            avatar_url: 'https://cdn-icons-png.flaticon.com/512/65/65578.png',
            embeds,
        });
    }
};
const redis = createClient({
    url: process.env.REDISCLOUD_URL,
});
const storeLatestRace = async (cust_id, latestRace) => {
    await redis.hSet(cust_id.toString(), 'endTime', latestRace.end_time);
    await redis.hSet(cust_id.toString(), 'subsessionId', latestRace.subsession_id);
};

redis.connect().then(async () => {
    const instance = await auth();
    // const roster = await fetchTeamData(instance);
    const roster = [
        { cust_id: 505047, display_name: 'Ole-Martin Mørk' },
        { cust_id: 779960, display_name: 'Ingar Almklov' },
    ];
    for (const member of roster) {
        console.log(member.cust_id);
        const latestRace = undefined; //await getLatestRace(member.cust_id);
        const races = (await fetchMembersLatest(instance, member, 5, latestRace?.endTime)).data;

        //const hosted = fetchMembersHosted(instance, member, endTime);
        for (const race of races) {
            const raceDetails = await getSubsession(instance, race.subsession_id, member.cust_id);
            await postToDiscord(instance, race, raceDetails, member);
        }

        if (races.length > 0) {
            const latestRace = races.sort(
                (a, b) => new Date(b.end_time).getTime() - new Date(a.end_time).getTime()
            )?.[0];
            await storeLatestRace(member.cust_id, latestRace);
        }
    }
    process.exit();
});
