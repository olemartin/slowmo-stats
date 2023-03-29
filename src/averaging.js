import { addWeeks, isAfter } from 'date-fns';

export const createAverageSerie = (series, startDate) => {
    const average = [];
    let date = startDate;
    while (date < new Date()) {
        let sum = 0;
        let count = 0;
        for (const serie of series) {
            let element = serie.stats.find((s) => isAfter(s.timestamp, date));
            if (!element) {
                element = serie.stats[serie.stats.length - 1];
            }
            if (!!element?.value && element.value !== 0) {
                sum += element.value;
                count++;
            }
        }
        average.push({ timestamp: date, value: sum / count });
        date = addWeeks(date, 1);
    }

    return average;
};
