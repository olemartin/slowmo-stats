import _ from 'underscore';
import { auth } from '../auth.js';
import { fetchTeamData } from '../integration.js';
import dotenv from 'dotenv';
dotenv.config();

const combineStats = (road, sportsCar) => {
    if (!road && !sportsCar) {
        return {};
    } else if (road && !sportsCar) {
        return road;
    } else if (sportsCar && !road) {
        return sportsCar;
    }
    return {
        starts: road.starts + sportsCar.starts,
        wins: road.wins + sportsCar.wins,
        top5: road.top5 + sportsCar.top5,
        poles: road.poles + sportsCar.poles,
        avg_start_position:
            (road.avg_start_position * road.starts + sportsCar.avg_start_position * sportsCar.starts) /
            (road.starts + sportsCar.starts),
        avg_finish_position:
            (road.avg_finish_position * road.starts + sportsCar.avg_finish_position * sportsCar.starts) /
            (road.starts + sportsCar.starts),
        laps: road.laps + sportsCar.laps,
        laps_led: road.laps_led + sportsCar.laps_led,
        avg_incidents:
            (road.avg_incidents * road.starts + sportsCar.avg_incidents * sportsCar.starts) /
            (road.starts + sportsCar.starts),
        win_percentage: (100 * (road.wins + sportsCar.wins)) / (road.starts + sportsCar.starts),
        top5_percentage: (100 * (road.top5 + sportsCar.top5)) / (road.starts + sportsCar.starts),
        laps_led_percentage: (100 * (road.laps_led + sportsCar.laps_led)) / (road.laps + sportsCar.laps),
    };
};
export const graphYearlyData = async (instance, rosterData) => {
    let statistics = [];
    const YEAR = 2024;
    await Promise.all(
        rosterData.map(async (member) => {
            const memberResponse = await instance.get('/data/stats/member_yearly', {
                params: {
                    cust_id: member.cust_id,
                },
            });
            const memberStats = await instance.get(memberResponse.data.link);
            const roadStats = memberStats.data.stats
                .filter((d) => d.year === YEAR)
                .filter((d) => d.category === 'Road');
            const sportsCarStats = memberStats.data.stats
                .filter((d) => d.year === YEAR)
                .filter((d) => d.category === 'Sports Car');
            const combined = combineStats(roadStats[0], sportsCarStats[0]);
            statistics.push({
                ...combined,
                cust_id: member.cust_id,
                display_name: member.display_name,
            });
        })
    );

    console.log('Totalt antall seiere: ' + statistics.map((s) => s.wins || 0).reduce((a, b) => a + b, 0));
    console.log('Totalt antall starter: ' + statistics.map((s) => s.starts || 0).reduce((a, b) => a + b, 0));
    console.log('Totalt antall top5: ' + statistics.map((s) => s.top5 || 0).reduce((a, b) => a + b, 0));
    console.log('Totalt antall runder: ' + statistics.map((s) => s.laps || 0).reduce((a, b) => a + b, 0));
    console.log('Totalt antall poles: ' + statistics.map((s) => s.poles || 0).reduce((a, b) => a + b, 0));
    statistics = statistics.filter((s) => s.starts >= 5);
    const maxStarts = _.max(statistics, (s) => s.starts);
    const maxWins = _.max(statistics, (s) => s.win_percentage);
    const maxTop5 = _.max(statistics, (s) => s.top5_percentage);
    const maxLaps = _.max(statistics, (s) => s.laps);
    const maxPoles = _.max(statistics, (s) => s.poles);
    const maxLapsLed = _.max(statistics, (s) => s.laps_led);
    const maxIncidents = _.max(statistics, (s) => s.avg_incidents);
    const minIncidents = _.min(statistics, (s) => s.avg_incidents);
    const minLaps = _.min(statistics, (s) => s.laps);
    console.log(
        maxStarts.display_name + ' startet ' + maxStarts.starts + ' løp og fullførte ' + maxStarts.laps + ' runder'
    );
    console.log(
        maxIncidents.display_name +
            ' hadde i snitt ' +
            parseInt(maxIncidents.avg_incidents, 10) +
            ' incs på ' +
            maxIncidents.starts +
            ' løp'
    );

    console.log(
        minIncidents.display_name +
            ' hadde i snitt ' +
            parseInt(minIncidents.avg_incidents, 10) +
            ' incs på ' +
            minIncidents.starts +
            ' løp'
    );
    console.log(
        maxWins.display_name + ' vant ' + parseInt(maxWins.win_percentage, 10) + '% av sine ' + maxWins.starts + ' løp'
    );
    console.log(
        maxTop5.display_name +
            ' kom topp 5 i ' +
            parseInt(maxTop5.top5_percentage, 10) +
            ' % av sine ' +
            maxTop5.starts +
            ' løp'
    );
    console.log(maxLapsLed.display_name + ' ledet ' + maxLapsLed.laps_led + ' av sine ' + maxLapsLed.laps + ' runder');
    console.log(
        maxPoles.display_name +
            ' hadde ' +
            maxPoles.poles +
            ' pole positions fordelt på ' +
            maxLapsLed.starts +
            ' starter'
    );

    console.log(maxLaps.display_name + ' kjørte ' + maxLaps.laps + ' runder');
    console.log(minLaps.display_name + ' kjørte ' + minLaps.laps + ' runder');
};
const run = async () => {
    const instance = await auth();
    const roster = await fetchTeamData(instance, 311379);
    try {
        await graphYearlyData(instance, roster);
    } catch (err) {
        console.error(err);
        process.exit(1);
        return;
    }
    process.exit(0);
};

Promise.all([run()]);
