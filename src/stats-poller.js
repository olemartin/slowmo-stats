import dotenv from 'dotenv';
import { fetchMembersLatest, fetchTeamData, getLaps, getSplitInformation, getSubsession } from './integration.js';
import { auth } from './auth.js';
import { createClient } from 'redis';
import teams from './teams.json' assert { type: 'json' };
import { postToDiscord } from './discord.js';
import { chartLaps } from './chart-laps.js';
import { getRaceSummary } from './chat-gpt-summary.js';

dotenv.config();

const getLatestRace = async (cust_id) => {
    return await redis.hGetAll(cust_id.toString());
};

const redis = createClient({
    url: process.env.REDISCLOUD_URL,
});
const storeLatestRace = async (cust_id, latestRace, subSessionIds) => {
    await redis.hSet(cust_id.toString(), 'endTime', latestRace.end_time);
    await redis.hSet(cust_id.toString(), 'subsessionId', latestRace.subsession_id);
    // await redis.list;
};

redis.connect().then(async () => {
    const instance = await auth();
    for (const team of teams) {
        const roster = await fetchTeamData(instance, team.teamId);
        // const team = teams[0];
        // const roster = [
        // { cust_id: 574032, display_name: 'Ola Braaten' },
        // { cust_id: 433879, display_name: 'Sveinung Mathisen' },
        // { cust_id: 505047, display_name: 'Ole-Martin Mørk' },
        // { cust_id: 779960, display_name: 'Ingar Almklov' },
        // { cust_id: 172053, display_name: 'Magnus Bjerkaker' },
        // ];
        for (const member of roster) {
            const latestRace = await (process.env.SEND_ALL_RACES ? undefined : getLatestRace(member.cust_id));
            const races = await fetchMembersLatest(instance, member, [3, 5], latestRace, 4);
            //const hosted = fetchMembersHosted(instance, member, endTime);
            for (const race of races) {
                console.log({ subSessionId: race.subsession_id, custId: member.cust_id });
                const splitInformation = await getSplitInformation(
                    instance,
                    race.session_id,
                    race.subsession_id,
                    race.start_time,
                    race.series_id,
                    5
                );
                const raceDetails = await getSubsession(instance, race.subsession_id, member.cust_id);
                const lapTimes = await getLaps(
                    instance,
                    race.subsession_id,
                    member.cust_id,
                    raceDetails.classParticipants || raceDetails.allParticipants || []
                );
                const chartData = await chartLaps({
                    instance,
                    subSessionId: race.subsession_id,
                    custId: member.cust_id,
                    lapTimes,
                });
                await postToDiscord({
                    instance,
                    race,
                    raceDetails,
                    splitInformation,
                    member,
                    team,
                    chartData,
                });
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
