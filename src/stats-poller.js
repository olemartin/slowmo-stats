import dotenv from 'dotenv';
import {
    fetchMembersHosted,
    fetchMembersLatest,
    fetchTeamData,
    getLaps,
    getSplitInformation,
    getSubsession
} from './integration.js';
import { createClient } from 'redis';
import teams from './teams.json' with { type: "json" };
import { postToDiscord } from './discord.js';
import { chartLaps } from './chart-laps.js';
import { getRaceSummary } from './chat-gpt-summary.js';

dotenv.config();

const getLatestRace = async (cust_id) => {
    return await redis.hGetAll(cust_id.toString());
};

const redisUrl = process.env.REDIS_URL
const redis = createClient({
    url: redisUrl,
    socket: {
        tls: (redisUrl.match(/rediss:/) != null),
        rejectUnauthorized: false,
    }
});

const storeLatestRace = async (cust_id, latestRace) => {
    await redis.hSet(cust_id.toString(), 'endTime', latestRace.end_time);
    await redis.hSet(cust_id.toString(), 'subsessionId', latestRace.subsession_id);
};

redis.connect().then(async () => {
    try {
        for (const team of teams) {
            const roster = await fetchTeamData(team.teamId);
            // const team = teams[0];
            // const roster = [
            // { cust_id: 574032, display_name: 'Ola Braaten' },
            // { cust_id: 433879, display_name: 'Sveinung Mathisen' },
            // { cust_id: 779960, display_name: 'Ingar Almklov' },
            // { cust_id: 172053, display_name: 'Magnus Bjerkaker' },
            // ];
            for (const member of roster) {
                const latestRace = await (process.env.SEND_ALL_RACES ? undefined : getLatestRace(member.cust_id));
                const races = await fetchMembersLatest(member, [3, 5], latestRace, 1);
                const previousRaces = await fetchMembersLatest(member, [3, 5], undefined, 4);
                //const hosted = await fetchMembersHosted(member, 1);
                for (const race of races) {
                    try {
                        console.log({ subSessionId: race.subsession_id, custId: member.cust_id });
                        const splitInformation = await getSplitInformation(
                            race.session_id,
                            race.subsession_id,
                            race.start_time,
                            race.series_id,
                            5
                        );
                        const raceDetails = await getSubsession(race.subsession_id, member.cust_id);
                        const lapTimes = await getLaps(
                            race.subsession_id,
                            member.cust_id,
                            raceDetails.classParticipants || raceDetails.allParticipants || []
                        );
                        const chartData = await chartLaps({
                            subSessionId: race.subsession_id,
                            custId: member.cust_id,
                            lapTimes
                        });
                        const raceSummary = await getRaceSummary({
                            lapTimes, raceDetails, team, member, race, races: previousRaces, splitInformation
                        });
                        await postToDiscord({
                            race,
                            raceDetails,
                            splitInformation,
                            member,
                            team,
                            chartData,
                            raceSummary
                        });

                    } catch (error) {
                        console.error('Error processing race', member.display_name, race.subsession_id, error);
                    }
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
    } catch (error) {
        console.error('Error in stats poller:', error);
        process.exit(1);
    }
});
