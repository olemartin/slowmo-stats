import { startOfDay, subWeeks } from "date-fns";

export async function fetchMembersLatest(instance, member, type, finishRange) {
  const startTime = subWeeks(startOfDay(new Date()), 1);
  const memberResponse = await instance.get("/data/results/search_series", {
    params: {
      cust_id: member.cust_id,
      start_range_begin: finishRange || startTime,
      official_only: true,
      event_types: type
    }
  });
  if (memberResponse.data.data.chunk_info.rows > 0) {
    return instance.get(memberResponse.data.data.chunk_info.base_download_url + memberResponse.data.data.chunk_info.chunk_file_names[0]);
  } else {
    return { data: [] };
  }
}


export async function fetchMembersHosted(instance, member) {
  const startTime = subWeeks(startOfDay(new Date()), 1);
  const memberResponse = await instance.get("/data/results/search_hosted", {
    params: {
      cust_id: member.cust_id,
      start_range_begin: startTime
    }
  });
  if (memberResponse.data.data.chunk_info.rows > 0) {
    return instance.get(memberResponse.data.data.chunk_info.base_download_url + memberResponse.data.data.chunk_info.chunk_file_names[0]);
  } else {
    return { data: [] };
  }
}


export const fetchTeamData = async (instance) => {
  const teamResponse = await instance.get("/data/team/get", {
    params: {
      team_id: 142955,
      include_licenses: true
    },
    withCredentials: true
  });
  return (await instance.get(teamResponse.data.link)).data.roster;
};

export async function getRaceCategories(instance) {
  const seriesResponse = await instance.get("/data/series/get");
  const seriesData = (await instance.get(seriesResponse.data.link)).data;
  const categories = seriesData.map(s => ({
    category: s.category,
    id: s.series_id
  }));
  return categories;
}

export async function getMemberChartData(instance, member, categoryId) {
  const memberResponse = await instance.get("/data/member/chart_data", {
    params: {
      cust_id: member.cust_id,
      category_id: categoryId,
      chart_type: 1
    }
  });
  return await instance.get(memberResponse.data.link);
}

export async function getSubsession(instance, subSessionId, custId) {

  async function getTeamDriver(raceDetails, custId) {

    const qualifyingResults = raceDetails.session_results.find(r => r.simsession_number === -1).results;
    const driverTeamQualifying = qualifyingResults.find(r => r.driver_results.find(r => r.cust_id === custId))
    const qualifying = driverTeamQualifying ? driverTeamQualifying.driver_results.find(r => r.cust_id === custId) : undefined

    const raceResults = raceDetails.session_results.find(r => r.simsession_number === 0).results;
    const driverTeamRace = raceResults.find(r => r.driver_results.find(r => r.cust_id === custId))
    const race = driverTeamRace ? driverTeamRace.driver_results.find(r => r.cust_id === custId) : undefined;


    return {
      race,
      qualifying
    };
  }

  const session = await instance.get("/data/results/get", {
    params: {
      subsession_id: subSessionId, include_licenses: true
    }
  });
  const data = await instance.get(session.data.link);
  const raceDetails = data.data;
  if (raceDetails.driver_changes) {
    return getTeamDriver(raceDetails, custId);
  }
  const qualifying = raceDetails.session_results.find(r => r.simsession_number === -1).results.find(r => r.cust_id === custId);
  const race = raceDetails.session_results.find(r => r.simsession_number === 0).results.find(r => r.cust_id === custId);

  return { race, qualifying };
}

export async function getLapData(instance, subSessionId, custId) {

  const session = await instance.get("/data/results/lap_data", {
    params: {
      subsession_id: subSessionId,
      cust_id: custId
    }
  });
  const data = await instance.get(session.data.link);
  return data;
}