import {
    getMemberChartData,
    fetchMembersHosted,
    fetchMembersLatest,
    fetchTeamData,
    getRaceCategories,
} from './integration.js';
import { differenceInMinutes, format, isAfter, subYears } from 'date-fns';
import _ from 'underscore';

import { createAverageSerie } from './averaging.js';
import { chartData } from './chart.js';
import { auth } from './auth.js';

import dotenv from 'dotenv';
dotenv.config();

const startDate = subYears(new Date(), 1);

const graphImprovementLastWeek = async (instance, rosterData, category) => {
    const categories = await getRaceCategories(instance);
    const data = (
        await Promise.all(
            rosterData.map(async (member) => {
                const stats = await fetchMembersLatest(instance, member, 5);
                const races = stats.data.races
                    .filter((r) => {
                        const cat = categories.find((c) => c.id === r.series_id)?.category;
                        return cat === category;
                    })
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
        'bar',
        data.map((r) => r.name),
        data.map((r) => r.ratingChange),
        'SloWmo ' + category + ' ir-change last week'
    );
};

const graphMostPopularSeriesLastWeek = async (instance, rosterData) => {
    const allSeries = [];
    await Promise.all(
        rosterData.map(async (member) => {
            const stats = await fetchMembersLatest(instance, member, 5);
            const series = stats.data.map((r) => r.series_name);
            allSeries.push(series);
        })
    );
    const grouped = _.groupBy(allSeries.flat(), (a) => a);

    const races = Object.keys(grouped).map((key) => ({
        key,
        count: grouped[key].length,
    }));

    return chartData(
        'bar',
        races.map((r) => r.key),
        races.map((r) => r.count),
        'Series last week'
    );
};
const graphMostActiveMembersLastWeek = async (instance, rosterData) => {
    const graphs = [];
    const labels = [];
    await Promise.all(
        rosterData.map(async (member) => {
            const stats = await fetchMembersLatest(instance, member);
            const hosted = await fetchMembersHosted(instance, member);
            if (stats?.data?.map) {
                const events = stats.data.map((r) => r.event_type_name);
                graphs.push({
                    name: member.display_name,
                    count: { ..._.countBy(events, (e) => e), Hosted: hosted?.data?.length || 0 },
                });
            }
        })
    );
    const datasets = [
        { label: 'Race', data: [] },
        { label: 'Practice', data: [] },
        {
            label: 'Qualify',
            data: [],
        },
        { label: 'Hosted', data: [] },
        { label: 'Time Trial', data: [] },
    ];

    for (const member of graphs) {
        if (Object.keys(member.count).some((k) => member.count[k] > 0)) {
            labels.push(member.name);
            for (const type of Object.keys(member.count)) {
                datasets.find((d) => d.label === type).data.push(member.count[type]);
            }
            _.difference(
                datasets.map((d) => d.label),
                Object.keys(member.count)
            ).forEach((t) => {
                datasets.find((d) => d.label === t).data.push(0);
            });
        }
    }
    return chartData(
        'stacked',
        labels,
        datasets.filter((d) => d.data.some((t) => t > 0)),
        'Most active SloWmos'
    );
};

const graphHistoricDataForTeam = async (instance, rosterData, categoryId, category) => {
    const series = [];
    await Promise.all(
        rosterData.map(async (member) => {
            const memberStats = await getMemberChartData(instance, member, categoryId);
            const stats = memberStats.data.data
                .filter((d) => isAfter(new Date(d.when), startDate))
                .map((d) => ({ timestamp: new Date(d.when), value: d.value }));
            series.push({
                stats,
            });
        })
    );
    const data = createAverageSerie(series, startDate);

    return chartData(
        'line',
        [],
        data.map((d) => ({
            y: Math.round(d.value),
            x: format(new Date(d.timestamp), 'yyyy-MM-dd'),
        })),
        'SloWmo ' + category + ' average ir'
    );
};
const graphIrData = async (rosterData, category) => {
    const labels = rosterData.map((member) => member.display_name);
    const data = rosterData.map((m) => {
        const license = m.licenses.find((l) => l.category === category);

        return {
            y: license.irating,
            x: m.display_name,
        };
    });

    return chartData(
        'bar',
        labels,
        data.map((d) => d.y),
        'SloWmo ' + category + ' iRating'
    );
};

const graphSrData = async (rosterData, category) => {
    const labels = rosterData.map((member) => member.display_name);
    const data = rosterData.map((m) => {
        const license = m.licenses.find((l) => l.category === category);
        return {
            license: license.group_id,
            rating: license.safety_rating,
        };
    });

    const datasets = [
        { label: 'R', data: [] },
        { label: 'D', data: [] },
        { label: 'C', data: [] },
        { label: 'B', data: [] },
        { label: 'A', data: [] },
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
    return chartData('stacked', labels, datasets, 'SloWmos ' + category + ' safety');
};

const run = async () => {
    if (new Date().getDay() !== 1) {
        console.log('Not monday');
        return;
    }
    const instance = await auth();

    const roster = await fetchTeamData(instance);
    const graphUrls = [
        await graphMostActiveMembersLastWeek(instance, roster),
        await graphMostPopularSeriesLastWeek(instance, roster),
        await graphSrData(roster, 'road'),
        await graphIrData(roster, 'road'),
        await graphHistoricDataForTeam(instance, roster, 2, 'road'),
        await graphImprovementLastWeek(instance, roster, 'road'),
        //await graphSrData(instance, roster, "oval"),
        //await graphIrData(instance, roster, "oval"),
        //await graphHistoricDataForTeam(instance, roster, 1, "oval"),
        //await graphImprovementLastWeek(instance, roster, "oval")
    ];

    console.log(JSON.stringify(graphUrls.map((u) => ({ image: { url: u } }))));
    if (process.env.DISCORD_WEBHOOK) {
        await instance.post(process.env.DISCORD_WEBHOOK, {
            username: 'SloWmo stats',
            avatar_url: 'https://cdn-icons-png.flaticon.com/512/4778/4778417.png',
            content: 'Ukens statistikk',
            embeds: graphUrls.map((u) => ({ image: { url: u } })),
        });
    }
};

Promise.all([run()])
    .catch((e) => {
        console.log(e);
    })
    .then(() => {
        console.log('Exiting');
        process.exit(0);
    });
