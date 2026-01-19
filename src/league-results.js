//https://members-ng.iracing.com/data/results/get?subsession_id=58777491
//https://members-ng.iracing.com/data/results/get?subsession_id=58777490
//https://members-ng.iracing.com/data/results/get?subsession_id=58758683
//https://members-ng.iracing.com/data/results/get?subsession_id=58758682

// https://members-ng.iracing.com/data/results/lap_data?simsession_number=0&subsession_id=58777490&cust_id=436196
//
//   "chunk_info": {
//   "chunk_size": 500,
//     "num_chunks": 1,
//     "rows": 10,
//     "base_download_url": "https://dqfp1ltauszrc.cloudfront.net/public/lapdata/subsession/58777490/0/436196/",
//     "chunk_file_names": [
//     "05305995ebba9f99167eb6fec3fd13689eb70e424731959aa6c7fa828a4f63b6.json"
//   ]
// },

//https://dqfp1ltauszrc.cloudfront.net/public/lapdata/subsession/58777490/0/436196/05305995ebba9f99167eb6fec3fd13689eb70e424731959aa6c7fa828a4f63b6.json

import { auth } from './auth.js';

async function getSession(instance, subSessionId) {
    const session = await instance.get('/data/results/get', {
        params: {
            subsession_id: subSessionId,
        },
    });

    const data = await instance.get(session.data.link);
    return data.data.session_results[0].results
        .map((d) => {
            return {
                cust_id: d.cust_id,
                subsession_id: subSessionId,
                display_name: d.display_name,
            };
        })
        .flat();
}

async function getLeague(leagueId) {
    const instance = await auth();
    const response = await instance.get(
        `/data/league/season_sessions?league_id=${leagueId}&results_only=true&season_id=110116`
    );
    const data = await instance.get(response.data.link);
    const sessions = data.data;
    for (const session of sessions) {
        const sessionData = await getSession(instance, session.subsession_id);
    }
}

async function getSeasons(leagueId) {
    const instance = await auth();
    const response = await instance.get(`/data/league/seasons?league_id=${leagueId}`);
    const data = await instance.get(response.data.link);
    console.log(JSON.stringify(data.data));
}

const getSessions = async () => {
    const instance = await auth();
    getLeague(instance, 8122);

    // const sortedTimes = times.sort((a, b) => a.average - b.average);
    //
    // // if (top10LapTimes.length > 0) {
    // //   console.log(
    // //     "\""+user.display_name + "\":",
    // //     "\"Valid laps:\"",
    // //     top10LapTimes.length,
    // //     "Average:",
    // //     dateAverage.getMinutes() + ":" + dateAverage.getSeconds() + ":" + dateAverage.getMilliseconds());
    // for (const time of sortedTimes) {
    //     const dateAverage = new Date(time.average);
    //
    //     console.log(
    //         '"' + time.display_name + '"',
    //         time.laps,
    //         time.validLaps,
    //         dateAverage.getMinutes() + ':' + dateAverage.getSeconds() + ':' + dateAverage.getMilliseconds()
    //     );
    // }
};

Promise.all([getLeague(8122)])
    .then(() => {
        console.log('Done');
        process.exit(0);
    })
    .catch((e) => console.log(e));
