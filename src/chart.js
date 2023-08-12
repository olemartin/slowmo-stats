import axios from 'axios';
import { stringify } from 'javascript-stringify';

const BASE_URL = 'https://quickchart.io/chart';

export const chartData = async (type, labels, data, title) => {
    let chart;
    if (type === 'bar') {
        chart = {
            type,
            data: {
                labels,
                datasets: [{ data }],
            },
            options: {
                legend: { display: false },
                title: { display: true, text: title },
                plugins: {
                    datalabels: {
                        anchor: 'center',
                        align: 'center',
                        color: '#fff',
                        font: {
                            weight: 'normal',
                        },
                    },
                },
            },
        };
    } else if (type === 'stacked') {
        chart = {
            type: 'bar',
            data: {
                labels,
                datasets: data,
            },
            options: {
                plugins: {
                    datalabels: {
                        color: '#FFF',
                        formatter: (value) => {
                            if (value !== 5 && value !== 0) {
                                return value;
                            }
                            return '';
                        },
                    },
                },
                title: {
                    display: true,
                    text: title,
                },
                scales: {
                    xAxes: [
                        {
                            stacked: true,
                        },
                    ],
                    yAxes: [
                        {
                            display: false,
                            stacked: true,
                        },
                    ],
                },
            },
        };
    } else {
        chart = {
            type: 'line',
            data: {
                datasets: [
                    {
                        lineTension: 0.1,
                        pointRadius: 0,
                        data,
                    },
                ],
            },
            options: {
                legend: {
                    display: false,
                },
                title: { display: true, text: title },
                scales: {
                    xAxes: [
                        {
                            type: 'time',
                        },
                    ],
                },
            },
        };
    }

    const shorten = await axios.post(`${BASE_URL}/create`, {
        chart: stringify(chart),
        width: 1000,
        height: 500,
    });
    console.log(shorten.data.url);
    return shorten.data.url;
};

export const chartCustomData = async ({ chart }) => {
    const shorten = await axios.post(`${BASE_URL}/create`, {
        chart: stringify(chart),
        width: 1000,
        height: 500,
        backgroundColor: '#CCCCCC',
    });
    console.log(shorten.data.url);
    return shorten.data.url;
};
