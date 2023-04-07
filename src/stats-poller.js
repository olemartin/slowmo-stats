import dotenv from 'dotenv';
import { fetchMembersLatest, getSplitInformation, fetchTeamData, getSubsession } from './integration.js';
import { auth } from './auth.js';
import { createClient } from 'redis';
import { format, formatInTimeZone } from 'date-fns-tz';
import nb from 'date-fns/locale/nb/index.js';
import teams from './teams.json' assert { type: 'json' };

dotenv.config();

const getLatestRace = async (cust_id) => {
    return await redis.hGetAll(cust_id.toString());
};

const postToDiscord = async (instance, race, raceDetails, splitInformation, member, team) => {
    const safetyFormatter = new Intl.NumberFormat('nb-NB', {
        signDisplay: 'exceptZero',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
    const safetyMajorFormatter = new Intl.NumberFormat('nb-NB', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
    const diffFormatter = new Intl.NumberFormat('nb-NB', {
        signDisplay: 'exceptZero',
    });

    const ratingFormatter = new Intl.NumberFormat('nb-NB');

    const mapLetter = (license) => {
        if (license <= 4) {
            return 'R';
        }
        if (license <= 8) {
            return 'D';
        }
        if (license <= 12) {
            return 'C';
        }
        if (license <= 16) {
            return 'B';
        }
        if (license <= 20) {
            return 'A';
        }
        return 'P';
    };
    const formatLicense = (race) => {
        const newLic = mapLetter(race.new_license_level);
        const oldLic = mapLetter(race.old_license_level);
        const newSub = race.new_sub_level;
        const oldSub = race.old_sub_level;

        if (newLic === oldLic) {
            return `${newLic} ${safetyMajorFormatter.format(newSub / 100.0)} (${safetyFormatter.format(
                (newSub - oldSub) / 100.0
            )})`;
        }
        return `${oldLic} ${safetyMajorFormatter.format(oldSub / 100.0)} ${
            newLic > oldLic ? '↘' : '↗'
        } ${newLic} ${safetyMajorFormatter.format(newSub / 100.0)}`;
    };

    let bestLap = new Date(raceDetails.race.best_lap_time / 10);
    let averageLap = new Date(raceDetails.race.average_lap / 10);
    let qualLap = raceDetails.qualifying ? new Date(raceDetails.qualifying.best_qual_lap_time / 10) : undefined;

    let poleposition = new Date(raceDetails.poleposition.best_qual_lap_time / 10);
    let fastestLap = new Date(raceDetails.fastestLap.best_lap_time / 10);
    let bestAverage = new Date(raceDetails.winner.average_lap / 10);

    const positionEmoji =
        race.finish_position_in_class === 0
            ? `🥇`
            : race.finish_position_in_class === 1
            ? `🥈`
            : race.finish_position_in_class === 2
            ? '🥉'
            : undefined;

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
                    name: `Split: ${splitInformation.splitId}/${splitInformation.splits}`,
                    value: `SOF: ${ratingFormatter.format(race.event_strength_of_field)}`,
                    inline: true,
                },
                {
                    name: 'Startnummer',
                    value: raceDetails.carNumber,
                    inline: true,
                },
                {
                    name: 'Startposisjon',
                    value: `${race.starting_position_in_class + 1}.`,
                    inline: true,
                },
                {
                    name: 'Plassering',
                    value: positionEmoji || `${race.finish_position_in_class + 1}.`,
                    inline: true,
                },
                {
                    name: 'Runder kjørt',
                    value: ratingFormatter.format(race.laps_complete),
                    inline: true,
                },
                {
                    name: 'Runder ledet',
                    value: ratingFormatter.format(race.laps_led),
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
                    value: `${raceDetails.poleposition.display_name} (${ratingFormatter.format(
                        raceDetails.poleposition.newi_rating
                    )})`,
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
                    value: `${raceDetails.winner.display_name} (${ratingFormatter.format(
                        raceDetails.winner.newi_rating
                    )})`,
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
                    value: `${raceDetails.fastestLap.display_name} (${ratingFormatter.format(
                        raceDetails.fastestLap.newi_rating
                    )})`,
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
                    value: `${formatLicense(raceDetails.race)}`,
                    inline: true,
                },
                {
                    name: 'iRating',
                    value: `${ratingFormatter.format(raceDetails.race.newi_rating)} (${diffFormatter.format(
                        raceDetails.race.newi_rating - raceDetails.race.oldi_rating
                    )})`,
                    inline: true,
                },
            ],
            footer: {
                text: `Kjørt ${formatInTimeZone(new Date(race.start_time), 'Europe/Oslo', 'eeee dd.MM.yyyy, HH:mm', {
                    locale: nb,
                })}`,
            },
        },
    ];

    if (process.env[team.discordUrl]) {
        await instance.post(process.env[team.discordUrl], {
            username: `${team.teamName} racebot`,
            title: `${team.memberName} has raced`,
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
    for (const team of teams) {
        const roster = await fetchTeamData(instance, team.teamId);
        // const roster = [
        // { cust_id: 505047, display_name: 'Ole-Martin Mørk' },
        // { cust_id: 779960, display_name: 'Ingar Almklov' },
        // { cust_id: 172053, display_name: 'Magnus Bjerkaker' },
        // ];
        for (const member of roster) {
            console.log(member.cust_id);
            const latestRace = await (process.env.SEND_ALL_RACES ? undefined : getLatestRace(member.cust_id));
            const races = (await fetchMembersLatest(instance, member, 5, latestRace?.endTime)).data;

            //const hosted = fetchMembersHosted(instance, member, endTime);
            for (const race of races) {
                const splitInformation = await getSplitInformation(
                    instance,
                    race.session_id,
                    race.subsession_id,
                    race.start_time,
                    race.series_id,
                    5
                );
                const raceDetails = await getSubsession(instance, race.subsession_id, member.cust_id);
                await postToDiscord(instance, race, raceDetails, splitInformation, member, team);
            }

            if (races.length > 0) {
                const latestRace = races.sort(
                    (a, b) => new Date(b.end_time).getTime() - new Date(a.end_time).getTime()
                )?.[0];
                await storeLatestRace(member.cust_id, latestRace);
            }
        }
    }
    process.exit();
});
