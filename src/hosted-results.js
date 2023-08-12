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

import auth from './auth.js';

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

const getSessions = async () => {
    const instance = await auth();

    const sessions = (
        await Promise.all([
            getSession(instance, 58962039),
            getSession(instance, 58962040),
            getSession(instance, 58981077),
            getSession(instance, 58981078),
        ])
    ).flat();

    const times = await Promise.all(
        sessions.map(async (user) => {
            const response = await instance.get('/data/results/lap_data', {
                params: {
                    simsession_number: 0,
                    subsession_id: user.subsession_id,
                    cust_id: user.cust_id,
                },
            });
            const data = await instance.get(response.data.link);

            if (data.data.chunk_info?.base_download_url) {
                const url = data.data.chunk_info.base_download_url + data.data.chunk_info.chunk_file_names;
                const laps = (await instance.get(url)).data;
                const validLapTimes = laps
                    .filter((l) => !l.incident && l.lap_time > 0 && l.lap_events.length === 0)
                    .map((l) => l.lap_time / 10)
                    .sort((a, b) => a - b);
                console.log(user.display_name, validLapTimes);
                console.log(
                    user.display_name,
                    validLapTimes
                        .filter((t) => t > 0)
                        .map((t) => new Date(t))
                        .map((t) => t.getMinutes() + ':' + t.getSeconds() + ':' + t.getMilliseconds())
                );
                const top10LapTimes = validLapTimes.slice(0, 10);
                const sum = top10LapTimes.reduce((a, b) => a + b, 0);
                return {
                    laps: laps.length,
                    validLaps: validLapTimes.length,
                    average: sum / top10LapTimes.length,
                    display_name: user.display_name,
                };
            }
        })
    );
    const sortedTimes = times.sort((a, b) => a.average - b.average);

    // if (top10LapTimes.length > 0) {
    //   console.log(
    //     "\""+user.display_name + "\":",
    //     "\"Valid laps:\"",
    //     top10LapTimes.length,
    //     "Average:",
    //     dateAverage.getMinutes() + ":" + dateAverage.getSeconds() + ":" + dateAverage.getMilliseconds());
    for (const time of sortedTimes) {
        const dateAverage = new Date(time.average);

        console.log(
            '"' + time.display_name + '"',
            time.laps,
            time.validLaps,
            dateAverage.getMinutes() + ':' + dateAverage.getSeconds() + ':' + dateAverage.getMilliseconds()
        );
    }
};

Promise.all([getSessions()])
    .then(() => {
        console.log('Done');
        process.exit(0);
    })
    .catch((e) => console.log(e));
