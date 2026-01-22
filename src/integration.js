import { addMinutes, isBefore, parseISO, startOfDay, subDays, subMinutes, subWeeks } from 'date-fns';
import axios from 'axios';
import api from './api.js';

const s3instance = axios.create();

export async function fetchMembersLatest(member, types, latestRace, numWeeks = 1) {
    const startTime = subWeeks(startOfDay(new Date()), numWeeks);
    const minTime = subDays(startOfDay(new Date()), 89);

    const finishRangeBegin = latestRace?.endTime
        ? isBefore(parseISO(latestRace.endTime), minTime)
            ? minTime
            : latestRace.endTime
        : startTime;

    const memberResponse = await api.get('/data/results/search_series', {
        params: {
            cust_id: member.cust_id,
            finish_range_begin: finishRangeBegin,
            official_only: false,
            event_types: types ? types.join(',') : undefined,
        },
    });
    if (memberResponse.data.data.chunk_info.rows > 0) {
        const races = await s3instance.get(
            memberResponse.data.data.chunk_info.base_download_url +
                memberResponse.data.data.chunk_info.chunk_file_names[0]
        );
        return races.data.filter((data) => data.subsession_id !== parseInt(latestRace?.subsessionId, 10));
    } else {
        return [];
    }
}

export async function getSplitInformation(sessionId, subsessionId, startTime, seriesId, type) {
    const response = await api.get('/data/results/search_series', {
        params: {
            start_range_begin: subMinutes(parseISO(startTime), 2),
            start_range_end: addMinutes(parseISO(startTime), 2),
            series_id: seriesId,
            official_only: true,
            event_types: type,
        },
    });
    if (response.data.data.chunk_info.rows > 0) {
        const splits = await s3instance.get(
            response.data.data.chunk_info.base_download_url + response.data.data.chunk_info.chunk_file_names[0]
        );

        const splitsFiltered = splits.data
            .filter((s) => s.session_id === sessionId)
            .sort((a, b) => a.subsession_id - b.subsession_id);
        const splitIndex = splitsFiltered.findIndex((s) => s.subsession_id === subsessionId);
        return { splits: splitsFiltered.length, splitId: splitIndex + 1 };
    }
}

export async function fetchMembersHosted(member, numWeeks = 1) {
    const startTime = subWeeks(startOfDay(new Date()), numWeeks);
    const memberResponse = await api.get('/data/results/search_hosted', {
        params: {
            cust_id: member.cust_id,
            start_range_begin: startTime,
        },
    });
    if (memberResponse.data.data.chunk_info.rows > 0) {
        return s3instance.get(
            memberResponse.data.data.chunk_info.base_download_url +
                memberResponse.data.data.chunk_info.chunk_file_names[0]
        );
    } else {
        return { data: [] };
    }
}

export const fetchTeamData = async (teamId) => {
    const teamResponse = await api.get('/data/team/get', {
        params: {
            team_id: teamId,
            include_licenses: true,
        },
    });
    return (await s3instance.get(teamResponse.data.link)).data.roster;
};

export async function getRaceCategories() {
    const seriesResponse = await api.get('/data/series/get');
    const seriesData = (await s3instance.get(seriesResponse.data.link)).data;
    const categories = seriesData.map((s) => ({
        category: s.category,
        id: s.series_id,
    }));
    return categories;
}

export async function getMemberChartData(member, categoryId) {
    const memberResponse = await api.get('/data/member/chart_data', {
        params: {
            cust_id: member.cust_id,
            category_id: categoryId,
            chart_type: 1,
        },
    });
    return await s3instance.get(memberResponse.data.link);
}

export async function getSubsession(subSessionId, custId) {
    async function getTeamDriver(raceDetails, custId) {
        const qualifyingResults = raceDetails.session_results.find((r) => r.simsession_name === 'QUALIFY').results;
        const driverTeamQualifying = qualifyingResults.find((r) => r.driver_results.find((r) => r.cust_id === custId));
        const qualifying = driverTeamQualifying
            ? driverTeamQualifying.driver_results.find((r) => r.cust_id === custId)
            : undefined;

        const raceResults = raceDetails.session_results.find((r) => r.simsession_name === 'RACE').results;
        const driverTeamRace = raceResults.find((r) => r.driver_results.find((r) => r.cust_id === custId));
        const race = driverTeamRace ? driverTeamRace.driver_results.find((r) => r.cust_id === custId) : undefined;

        const poleposition = qualifyingResults
            ? qualifyingResults.find((r) => r.finish_position_in_class === 0 && r.car_class_id === race.car_class_id)
            : undefined;

        const winner = raceResults.find(
            (r) => r.finish_position_in_class === 0 && r.car_class_id === race.car_class_id
        );

        const fastestLap = raceResults
            .filter((r) => r.best_lap_time !== -1 && r.car_class_id === race.car_class_id)
            .sort((a, b) => a.best_lap_time - b.best_lap_time)[0];

        return {
            race,
            qualifying,
            fastestLap,
            winner,
            poleposition,
            carNumber: 0,
            sof: 0,
        };
    }

    const session = await api.get('/data/results/get', {
        params: {
            subsession_id: subSessionId,
            include_licenses: true,
        },
    });

    const data = await s3instance.get(session.data.link);
    const raceDetails = data.data;

    if (raceDetails.driver_changes) {
        return getTeamDriver(raceDetails, custId);
    }
    const qualifying = raceDetails.session_results
        .find((r) => r.simsession_name === 'QUALIFY')
        ?.results.find((r) => r.cust_id === custId);

    const race = raceDetails.session_results
        .find((r) => r.simsession_name === 'RACE')
        ?.results.find((r) => r.cust_id === custId);

    const poleposition = raceDetails.session_results
        .find((r) => r.simsession_name === 'QUALIFY')
        ?.results.find((r) => r.finish_position_in_class === 0 && r.car_class_id === qualifying.car_class_id);

    const winner = raceDetails.session_results
        .find((r) => r.simsession_name === 'RACE')
        ?.results.find((r) => r.finish_position_in_class === 0 && r.car_class_id === race.car_class_id);

    const fastestLap = raceDetails.session_results
        .find((r) => r.simsession_name === 'RACE')
        ?.results.filter((r) => r.best_lap_time !== -1 && r.car_class_id === race.car_class_id)
        .sort((a, b) => a.best_lap_time - b.best_lap_time)[0];

    const carNumber =
        raceDetails.session_results
            .find((r) => r.simsession_name === 'RACE')
            ?.results.sort((a, b) => b.oldi_rating - a.oldi_rating)
            .findIndex((r) => r.cust_id === custId) + 1;

    const classParticipants = raceDetails.session_results
        .find((r) => r.simsession_name === 'RACE')
        ?.results.filter((r) => r.car_class_id === race.car_class_id);

    const allParticipants = raceDetails.session_results.find((r) => r.simsession_name === 'RACE')?.results;

    const sof = classParticipants
        ? classParticipants.reduce((a, b) => a + b.oldi_rating, 0) / classParticipants.length
        : undefined;

    // console.log({ classParticipants });
    // console.log({
    //     participants: classParticipants.map((c) => ({
    //         classInterval: c.class_interval,
    //         finished: c.finish_position_in_class + 1,
    //         reason: c.reason_out,
    //     })),
    // });

    return {
        race,
        qualifying,
        poleposition,
        winner,
        fastestLap,
        carNumber,
        sof,
        classParticipants,
        allParticipants,
    };
}

export async function getLaps(subSessionId, custId, classParticipants) {
    const response = await api.get('/data/results/lap_chart_data', {
        params: {
            subsession_id: subSessionId,
            simsession_number: 0,
        },
    });

    const s3Response = await s3instance.get(response.data.link);

    if (s3Response.data.chunk_info?.base_download_url) {
        const lapTimes = [];

        for (const chunkFileName of s3Response.data.chunk_info.chunk_file_names) {
            const url = s3Response.data.chunk_info.base_download_url + chunkFileName;
            const laps = (await s3instance.get(url)).data;
            lapTimes.push(
                ...laps
                    .filter((l) => classParticipants.find((c) => c.cust_id === l.cust_id))
                    .map((l) => ({
                        time: l.lap_time,
                        personalBestLap: l.personal_best_lap,
                        fastestLap: l.fastest_lap,
                        incs: l.incident,
                        position: l.lap_position,
                        lapNumber: l.lap_number,
                        events: l.lap_events,
                        custId: l.cust_id,
                    }))
            );
        }
        lapTimes.sort((a, b) =>
            a.lapNumber < b.lapNumber ? -1 : a.lapNumber > b.lapNumber ? 1 : a.position - b.position
        );
        lapTimes.forEach((l, index) => {
            if (!lapTimes[index - 1]) {
                l.classPosition = 1;
            } else if (lapTimes[index - 1].lapNumber !== l.lapNumber) {
                l.classPosition = 1;
            } else {
                l.classPosition = lapTimes[index - 1].classPosition + 1;
            }

            if (!lapTimes[index + 1]) {
                return;
            }
        });
        return lapTimes.filter((l) => l.custId === custId);
    }
    return [];
}
