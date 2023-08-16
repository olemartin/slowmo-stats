import { format } from 'date-fns';

const mapLapTime = ({ lapTime, add }) => {
    if (!lapTime || lapTime.time === -1) {
        return '';
    }
    const t = new Date(Math.max((lapTime.time + (add || 0)) / 10, 0));
    return format(t, 'mm:ss.SSS');
};
const mapPosition = ({ lapTime, add }) => {
    //console.log({ lapTime, add });
    return lapTime.position + (add || 0);
};

export const chartLaps = async ({ instance, subSessionId, custId }) => {
    const response = await instance.get('/data/results/lap_chart_data', {
        params: {
            subsession_id: subSessionId,
            simsession_number: 0,
        },
    });
    console.log({ subSessionId });
    const s3Response = await instance.get(response.data.link);

    if (s3Response.data.chunk_info?.base_download_url) {
        const lapTimes = [];

        for (const chunkFileName of s3Response.data.chunk_info.chunk_file_names) {
            const url = s3Response.data.chunk_info.base_download_url + chunkFileName;
            const laps = (await instance.get(url)).data;
            lapTimes.push(
                ...laps
                    .filter((l) => l.cust_id === custId)
                    .filter((l) => l.lap_number !== 0)
                    .map((l) => ({
                        time: l.lap_time,
                        personalBestLap: l.personal_best_lap,
                        fastestLap: l.fastest_lap,
                        incs: l.incident,
                        position: l.lap_position,
                        lapNumber: l.lap_number,
                    }))
            );
        }
        if (!lapTimes.find((l) => !!l && l.time !== -1)) {
            return { laptimeChart: null, positionChart: null };
        }

        const minTime = lapTimes.filter((l) => l.time !== -1).sort((a, b) => a.time - b.time)[0];
        const maxTime = lapTimes.filter((l) => l.time !== -1).sort((a, b) => b.time - a.time)[0];
        const minPosition = lapTimes.sort((a, b) => a.position - b.position)[0];
        const maxPosition = lapTimes.sort((a, b) => b.position - a.position)[0];

        lapTimes.sort((a, b) => a.lapNumber - b.lapNumber);

        const laptimeChart = {
            type: 'line',
            data: {
                labels: lapTimes.map((l) => l.lapNumber),
                datasets: [
                    {
                        type: 'line',
                        fill: false,
                        borderColor: '#404090',
                        backgroundColor: 'rgba(0,0,0,0)',
                        pointBorderColor: lapTimes.map((l) => (l.incs ? '#F00' : '#000')),
                        pointBackgroundColor: lapTimes.map((l) => (l.incs ? '#F00' : '#000')),
                        data: lapTimes.map((l) => mapLapTime({ lapTime: l })),
                    },
                ],
            },
            options: {
                legend: { display: false },
                scales: {
                    yAxes: [
                        {
                            position: 'left',
                            type: 'time',
                            time: {
                                parser: 'm:s.SSS',
                                unit: 'second',
                                min: mapLapTime({ lapTime: minTime, add: -20000 }),
                                max: mapLapTime({ lapTime: maxTime, add: 20000 }),
                                displayFormats: {
                                    second: 'mm:ss',
                                },
                            },
                        },
                    ],
                },
                title: {
                    display: true,
                    text: 'Rundetider',
                },
            },
        };
        const positionChart = {
            type: 'line',
            data: {
                labels: lapTimes.map((l) => l.lapNumber),
                datasets: [
                    {
                        type: 'line',
                        fill: false,
                        borderColor: '#404090',
                        data: lapTimes.map((l) => mapPosition({ lapTime: l })),
                        pointBorderColor: lapTimes.map((l) => (l.incs ? '#F00' : '#000')),
                        pointBackgroundColor: lapTimes.map((l) => (l.incs ? '#F00' : '#000')),
                        backgroundColor: 'rgba(0,0,0,0)',
                    },
                ],
            },
            options: {
                legend: { display: false },
                scales: {
                    yAxes: [
                        {
                            ticks: {
                                stepSize: 1,
                                reverse: true,
                                min: mapPosition({ lapTime: minPosition, add: -1 }),
                                max: mapPosition({ lapTime: maxPosition, add: 1 }),
                            },
                        },
                    ],
                },
                title: {
                    display: true,
                    text: 'Plassering',
                },
            },
        };
        return { laptimeChart, positionChart };
    }
};
