
require("dotenv").config();

const { subYears, isAfter, subWeeks, differenceInMinutes, format } = require("date-fns");
const _ = require("underscore");

const { createAverageSerie } = require("./averaging");
const { chartData } = require("./chart");
const { auth } = require("./auth");

const startDate = subYears(new Date(), 1);

const fetchTeamData = async (instance) => {
  const teamResponse = await instance.get("/data/team/get", {
    params: {
      team_id: 142955,
      include_licenses: true
    },
    withCredentials: true
  });
  return (await instance.get(teamResponse.data.link)).data.roster;
};

async function fetchMembersLatestRaces(instance, member) {
  const memberResponse = await instance.get("/data/stats/member_recent_races", {
    params: {
      cust_id: member.cust_id
    }
  });
  return instance.get(memberResponse.data.link);
}

const graphImprovementLastWeek = async (instance, rosterData) => {

  const seriesResponse = await instance.get("/data/series/get");
  const seriesData = (await instance.get(seriesResponse.data.link)).data;
  const categories = seriesData.map(s => ({
    category: s.category,
    id: s.series_id
  }));



  const data = (
    await Promise.all(
      rosterData.map(async (member) => {
        const stats = await fetchMembersLatestRaces(instance, member);
        const races = stats.data.races
          .filter((r) => isAfter(new Date(r.session_start_time), subWeeks(new Date(), 1)))
          .filter((r) => {
            const category = categories.find(c => c.id === r.series_id)?.category;
            return category === "road";
          })
          .sort((a, b) => differenceInMinutes(new Date(a.session_start_time), new Date(b.session_start_time)))
          .map((r) => ({
            n: r.newi_rating,
            o: r.oldi_rating,
            ns: r.new_sub_level,
            os: r.old_sub_level,
            ll: r.license_level
          }));

        if (races.length > 0) {
          const startIrating = races[0].o;
          const endIrating = races[races.length - 1].n;
          return [
            {
              name: member.display_name,
              ratingChange: endIrating - startIrating
            }
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

const graphMostPopularSeriesLastWeek = async (instance, rosterData) => {
  const allSeries = [];
  await Promise.all(
    rosterData.map(async (member) => {
      const stats = await fetchMembersLatestRaces(instance, member);
      const series = stats.data.races
        .filter((r) => isAfter(new Date(r.session_start_time), subWeeks(new Date(), 1)))
        .map((r) => r.series_name);
      allSeries.push(series);
    })
  );
  const grouped = _.groupBy(allSeries.flat(), (a) => a);

  const races = Object.keys(grouped).map((key) => ({
    key,
    count: grouped[key].length
  }));

  return chartData(
    "bar",
    races.map((r) => r.key),
    races.map((r) => r.count),
    "Series last week"
  );
};

const graphHistoricDataForTeam = async (instance, rosterData) => {
  const series = [];
  await Promise.all(
    rosterData.map(async (member) => {
      const memberResponse = await instance.get("/data/member/chart_data", {
        params: {
          cust_id: member.cust_id,
          category_id: 2,
          chart_type: 1
        }
      });
      const memberStats = await instance.get(memberResponse.data.link);
      const stats = memberStats.data.data
        .filter((d) => isAfter(new Date(d.when), startDate))
        .map((d) => ({ timestamp: new Date(d.when), value: d.value }));
      series.push({
        stats
      });
    })
  );
  const data = createAverageSerie(series, startDate);

  return chartData(
    "line",
    [],
    data.map((d) => ({
      y: Math.round(d.value),
      x: format(new Date(d.timestamp), "yyyy-MM-dd")
    })),
    "SloWmos average ir"
  );
};

const graphYearlyData = async (instance, rosterData) => {
  const statistics = [];
  await Promise.all(
    rosterData.map(async (member) => {
      const memberResponse = await instance.get("/data/stats/member_yearly", {
        params: {
          cust_id: member.cust_id
        }
      });
      const memberStats = await instance.get(memberResponse.data.link);
      const stats = memberStats.data.stats
        .filter((d) => d.year === 2022)
        .filter((d) => d.category === "Road");
      statistics.push(
        { ...stats[0], cust_id: member.cust_id, display_name: member.display_name }
      );
    })
  );

  console.log("Totalt antall seiere: " + statistics.map(s => s.wins).reduce((a, b) => a + b, 0));
  console.log("Totalt antall starter: " + statistics.map(s => s.starts).reduce((a, b) => a + b, 0));
  console.log("Totalt antall top5: " + statistics.map(s => s.top5).reduce((a, b) => a + b, 0));
  console.log("Totalt antall runder: " + statistics.map(s => s.laps).reduce((a, b) => a + b, 0));
  console.log("Totalt antall poles: " + statistics.map(s => s.poles).reduce((a, b) => a + b, 0));
  const maxStarts = _.max(statistics, (s) => s.starts);
  const maxWins = _.max(statistics, (s) => s.win_percentage);
  const maxTop5 = _.max(statistics, (s) => s.top5_percentage);
  const maxLaps = _.max(statistics, (s) => s.laps);
  const maxPoles = _.max(statistics, (s) => s.poles);
  const maxLapsLed = _.max(statistics, (s) => s.laps_led);
  const minLaps = _.min(statistics, (s) => s.laps);
  console.log(maxStarts.display_name + " startet " + maxStarts.starts + " løp og fullførte " + maxStarts.laps);
  console.log(maxWins.display_name + " vant " + maxWins.win_percentage + "% av sine " + maxWins.starts + " løp");
  console.log(maxTop5.display_name + " kom topp 5 i " + maxTop5.top5_percentage + "% av sine " + maxTop5.starts + " løp");
  console.log(maxLapsLed.display_name + " ledet " + maxLapsLed.laps_led + " av sine " + maxLapsLed.laps + " runder");
  console.log(maxPoles.display_name + " hadde " + maxPoles.poles + " pole positions fordelt på " + maxLapsLed.starts + " starter");
  console.log(maxLaps.display_name + " kjørte " + maxLaps.laps + " runder");
  console.log(minLaps.display_name + " kjørte " + minLaps.laps + " runder");
};

const graphIrData = async (instance, rosterData) => {
  const labels = rosterData.map((member) => member.display_name);
  const data = rosterData.map((m) => {
    const license = m.licenses.find((l) => l.category === "road");

    return {
      y: license.irating,
      x: m.display_name
    };
  });

  return chartData(
    "bar",
    labels,
    data.map((d) => d.y),
    "SloWmos iRating"
  );
};

const graphSrData = async (instance, rosterData) => {
  const labels = rosterData.map((member) => member.display_name);
  const data = rosterData.map((m) => {
    const license = m.licenses.find((l) => l.category === "road");
    return {
      license: license.group_id,
      rating: license.safety_rating
    };
  });

  const datasets = [
    { label: "R", data: [] },
    { label: "D", data: [] },
    { label: "C", data: [] },
    { label: "B", data: [] },
    { label: "A", data: [] }
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

const run = async () => {
  const instance = await auth();

  const roster = await fetchTeamData(instance);
  const promises = await Promise.all([
    graphSrData(instance, roster),
    // graphIrData(instance, roster),
    // graphHistoricDataForTeam(instance, roster),
    // graphMostPopularSeriesLastWeek(instance, roster),
    // graphImprovementLastWeek(instance, roster)
  ]);

  const graphUrls = await Promise.all(promises);
  console.log(JSON.stringify(graphUrls.map((u) => ({ image: { url: u } }))));

  await instance.post(process.env.DISCORD_WEBHOOK, {
      content: graphUrls.map((u) => ({ image: { url: u } }))
  });

};

Promise.all([run()]).catch((e) => {
  console.log(e);
}).then(res => {
  console.log("Exiting")
  process.exit(0);
});
