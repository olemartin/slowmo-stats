import { format } from 'date-fns';

export const mapLapTime = ({ lapTime, add, formatString = 'mm:ss.SSS' }) => {
    if (!lapTime || lapTime.time === -1) {
        return '';
    }
    const t = new Date(Math.max((lapTime.time + (add || 0)) / 10, 0));
    return format(t, formatString);
};
const mapPosition = ({ lapTime, add }) => {
    return lapTime.classPosition + (add || 0);
};

export const chartLaps = async ({ lapTimes }) => {
    if (!lapTimes.find((l) => !!l && l.time !== -1)) {
        return { laptimeChart: null, positionChart: null };
    }

    const minTime = lapTimes.filter((l) => l.time !== -1).sort((a, b) => a.time - b.time)[0];
    const maxTime = lapTimes.filter((l) => l.time !== -1).sort((a, b) => b.time - a.time)[0];
    const minPosition = lapTimes.sort((a, b) => a.classPosition - b.classPosition)[0];
    const maxPosition = lapTimes.sort((a, b) => b.classPosition - a.classPosition)[0];

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

    //console.log(JSON.stringify({ laptimeChart, positionChart }));
    return { laptimeChart, positionChart };
};
