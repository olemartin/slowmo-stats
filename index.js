const axios = require("axios");
const SHA256 = require("crypto-js/sha256");
const Base64 = require("crypto-js/enc-base64");
const { wrapper } = require("axios-cookiejar-support");
const { CookieJar } = require("tough-cookie");
const { subYears, isAfter, subWeeks, differenceInMinutes, format } = require("date-fns");
const rateLimit = require("axios-rate-limit");
const _ = require("underscore");
require("dotenv").config();

const jar = new CookieJar();
const email = process.env.IRACING_USERNAME;
const password = process.env.IRACING_PASSWORD;

const { createAverageSerie } = require("./averaging");
const { chartData } = require("./chart");

const hash = SHA256(password + email.toLowerCase());
const hashInBase64 = Base64.stringify(hash);

const startDate = subYears(new Date(), 1);

const instance = wrapper(
  rateLimit(
    axios.create({
      withCredentials: true,
      baseURL: "https://members-ng.iracing.com",
      jar,
    }),
    { maxRPS: 5 }
  )
);

const fetchTeamData = async () => {
  await instance.post("/auth", {
    email,
    password: hashInBase64,
  });

  const teamResponse = await instance.get("/data/team/get", {
    params: {
      team_id: 142955,
      include_licenses: true,
    },
    withCredentials: true,
  });
  return (await axios.get(teamResponse.data.link)).data.roster;
};

async function fetchMembersLatestRaces(member) {
  const memberResponse = await instance.get("/data/stats/member_recent_races", {
    params: {
      cust_id: member.cust_id,
    },
  });

  return axios.get(memberResponse.data.link);
}

const graphImprovementLastWeek = async (rosterData) => {
  const data = (
    await Promise.all(
      rosterData.map(async (member) => {
        const stats = await fetchMembersLatestRaces(member);
        const races = stats.data.races
          .filter((r) => isAfter(new Date(r.session_start_time), subWeeks(new Date(), 1)))
          .sort((a, b) => differenceInMinutes(new Date(a.session_start_time), new Date(b.session_start_time)))
          .map((r) => ({
            n: r.newi_rating,
            o: r.oldi_rating,
            ns: r.new_sub_level,
            os: r.old_sub_level,
            ll: r.license_level,
          }));

        if (races.length > 0) {
          const startIrating = races[0].o;
          const endIrating = races[races.length - 1].n;
          return [
            {
              name: member.display_name,
              ratingChange: endIrating - startIrating,
            },
          ];
        }
        return [];
      })
    )
  ).flat();
  return chartData(
    "bar",
    data.map((r) => r.name),
    data.map((r) => r.ratingChange),
    "SloWmo ir-change last week"
  );
};

const graphMostPopularSeriesLastWeek = async (rosterData) => {
  const allSeries = [];
  await Promise.all(
    rosterData.map(async (member) => {
      const stats = await fetchMembersLatestRaces(member);
      const series = stats.data.races
        .filter((r) => isAfter(new Date(r.session_start_time), subWeeks(new Date(), 1)))
        .map((r) => r.series_name);
      allSeries.push(series);
    })
  );
  const grouped = _.groupBy(allSeries.flat(), (a) => a);

  const races = Object.keys(grouped).map((key) => ({
    key,
    count: grouped[key].length,
  }));

  return chartData(
    "bar",
    races.map((r) => r.key),
    races.map((r) => r.count),
    "Series last week"
  );
};

const graphHistoricDataForTeam = async (rosterData) => {
  const series = [];
  await Promise.all(
    rosterData.map(async (member) => {
      const memberResponse = await instance.get("/data/member/chart_data", {
        params: {
          cust_id: member.cust_id,
          category_id: 2,
          chart_type: 1,
        },
      });
      const memberStats = await axios.get(memberResponse.data.link);
      const stats = memberStats.data.data
        .filter((d) => isAfter(new Date(d.when), startDate))
        .map((d) => ({  timestamp: new Date(d.when), value: d.value,  }));
      series.push({
        stats,
      });
    })
  );
  const data = createAverageSerie(series);

  return chartData(
    "line",
    [],
    data.map((d) => ({
      y: Math.round(d.value),
      x: format(new Date(d.timestamp), "yyyy-MM-dd"),
    })),
    "SloWmos average ir"
  );
};

const graphIrData = async (rosterData) => {
  const labels = rosterData.map((member) => member.display_name);
  const data = rosterData.map((m) => {
    const license = m.licenses.find((l) => l.category === "road");

    return {
      y: license.irating,
      x: m.display_name,
    };
  });

  return chartData(
    "bar",
    labels,
    data.map((d) => d.y),
    "SloWmos iRating"
  );
};

const graphSrData = async (rosterData) => {
  const labels = rosterData.map((member) => member.display_name);
  const data = rosterData.map((m) => {
    const license = m.licenses.find((l) => l.category === "road");
    return {
      license: license.group_id,
      rating: license.safety_rating,
    };
  });

  const datasets = [
    { label: "R", data: [] },
    { label: "D", data: [] },
    { label: "C", data: [] },
    { label: "B", data: [] },
    { label: "A", data: [] },
  ];

  for (const memberData of data) {
    for (let i = 0; i < memberData.license - 1; i++) {
      datasets[i].data.push(5);
    }
    datasets[memberData.license - 1].data.push(memberData.rating);
    for (let i = memberData.license; i < datasets.length; i++) {
      datasets[i].data.push(0);
    }
  }
  return chartData("stacked", labels, datasets, "SloWmos Safety");
};

fetchTeamData()
  .then((roster) => {
    const promises = Promise.all([
      graphSrData(roster),
      graphIrData(roster),
      graphHistoricDataForTeam(roster),
      graphMostPopularSeriesLastWeek(roster),
      graphImprovementLastWeek(roster),
    ]);
    promises.then((graphUrls) => {
      console.log(JSON.stringify(graphUrls.map((u) => ({ image: { url: u } }))));
      process.exit(0);
    });
  })
  .catch((e) => {
    console.log(e);
  });
