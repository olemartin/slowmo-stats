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
                    backgroundColor: 'transparent',
                    pointBorderColor: lapTimes.map((l) => (l.incs ? '#F00' : '#000')),
                    pointBackgroundColor: lapTimes.map((l) => (l.incs ? '#F00' : '#000')),
                    data: lapTimes.map((l) => l?.time),
                },
            ],
        },
        options: {
            plugins: {
                legend: { display: false },
                title: {
                    display: true,
                    text: 'Lap times',
                },
            },
            scales: {
                y: {
                    position: 'left',
                    type: 'linear',
                    //min: minTime.time - 25000,
                    //max: maxTime.time + 25000,
                    ticks: {
                        stepSize: 20,
                        callback: function (v) {
                            if (v <= 0) {
                                return '';
                            }
                            return new Date(v / 10).toISOString().substr(14, 9);
                        },
                    },
                },
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
                text: 'Position',
            },
        },
    };

    return { laptimeChart, positionChart };
};
