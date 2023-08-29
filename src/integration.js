import { startOfDay, subWeeks, addMinutes, subMinutes, parseISO, subDays, isBefore } from 'date-fns';

export async function fetchMembersLatest(instance, member, types, latestRace) {
    const startTime = subWeeks(startOfDay(new Date()), 4);
    const minTime = subDays(startOfDay(new Date()), 89);

    const finishRangeBegin = latestRace?.endTime
        ? isBefore(parseISO(latestRace.endTime), minTime)
            ? minTime
            : latestRace.endTime
        : startTime;

    const memberResponse = await instance.get('/data/results/search_series', {
        params: {
            cust_id: member.cust_id,
            finish_range_begin: finishRangeBegin,
            official_only: true,
            event_types: types ? types.join(',') : undefined,
        },
    });
    if (memberResponse.data.data.chunk_info.rows > 0) {
        const races = await instance.get(
            memberResponse.data.data.chunk_info.base_download_url +
                memberResponse.data.data.chunk_info.chunk_file_names[0]
        );
        return races.data.filter((data) => data.subsession_id !== parseInt(latestRace?.subsessionId, 10));
    } else {
        return [];
    }
}

export async function getSplitInformation(instance, sessionId, subsessionId, startTime, seriesId, type) {
    const response = await instance.get('/data/results/search_series', {
        params: {
            start_range_begin: subMinutes(parseISO(startTime), 2),
            start_range_end: addMinutes(parseISO(startTime), 2),
            series_id: seriesId,
            official_only: true,
            event_types: type,
        },
    });
    if (response.data.data.chunk_info.rows > 0) {
        const splits = await instance.get(
            response.data.data.chunk_info.base_download_url + response.data.data.chunk_info.chunk_file_names[0]
        );

        const splitsFiltered = splits.data
            .filter((s) => s.session_id === sessionId)
            .sort((a, b) => a.subsession_id - b.subsession_id);
        const splitIndex = splitsFiltered.findIndex((s) => s.subsession_id === subsessionId);
        return { splits: splitsFiltered.length, splitId: splitIndex + 1 };
    }
}

export async function fetchMembersHosted(instance, member) {
    const startTime = subWeeks(startOfDay(new Date()), 1);
    const memberResponse = await instance.get('/data/results/search_hosted', {
        params: {
            cust_id: member.cust_id,
            start_range_begin: startTime,
        },
    });
    if (memberResponse.data.data.chunk_info.rows > 0) {
        return instance.get(
            memberResponse.data.data.chunk_info.base_download_url +
                memberResponse.data.data.chunk_info.chunk_file_names[0]
        );
    } else {
        return { data: [] };
    }
}

export const fetchTeamData = async (instance, teamId) => {
    const teamResponse = await instance.get('/data/team/get', {
        params: {
            team_id: teamId,
            include_licenses: true,
        },
        withCredentials: true,
    });
    return (await instance.get(teamResponse.data.link)).data.roster;
};

export async function getRaceCategories(instance) {
    const seriesResponse = await instance.get('/data/series/get');
    const seriesData = (await instance.get(seriesResponse.data.link)).data;
    const categories = seriesData.map((s) => ({
        category: s.category,
        id: s.series_id,
    }));
    return categories;
}

export async function getMemberChartData(instance, member, categoryId) {
    const memberResponse = await instance.get('/data/member/chart_data', {
        params: {
            cust_id: member.cust_id,
            category_id: categoryId,
            chart_type: 1,
        },
    });
    return await instance.get(memberResponse.data.link);
}

export async function getSubsession(instance, subSessionId, custId) {
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

        const carNumber =
            raceResults.sort((a, b) => b.oldi_rating - a.oldi_rating).findIndex((r) => r.cust_id === custId) + 1;

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

    const session = await instance.get('/data/results/get', {
        params: {
            subsession_id: subSessionId,
            include_licenses: true,
        },
    });

    const data = await instance.get(session.data.link);
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

    const sof = classParticipants
        ? classParticipants.reduce((a, b) => a + b.oldi_rating, 0) / classParticipants.length
        : undefined;

    return {
        race,
        qualifying,
        poleposition,
        winner,
        fastestLap,
        carNumber,
        sof,
        classParticipants,
    };
}

export async function getLaps(instance, subSessionId, custId) {
    const response = await instance.get('/data/results/lap_chart_data', {
        params: {
            subsession_id: subSessionId,
            simsession_number: 0,
        },
    });

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
                        events: l.lap_events,
                    }))
            );
        }
        return lapTimes;
    }
    return [];
}
