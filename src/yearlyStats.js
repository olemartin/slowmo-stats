import _ from 'underscore';

export const graphYearlyData = async (instance, rosterData) => {
    const statistics = [];
    await Promise.all(
        rosterData.map(async (member) => {
            const memberResponse = await instance.get('/data/stats/member_yearly', {
                params: {
                    cust_id: member.cust_id,
                },
            });
            const memberStats = await instance.get(memberResponse.data.link);
            const stats = memberStats.data.stats.filter((d) => d.year === 2022).filter((d) => d.category === 'Road');
            statistics.push({ ...stats[0], cust_id: member.cust_id, display_name: member.display_name });
        })
    );

    console.log('Totalt antall seiere: ' + statistics.map((s) => s.wins).reduce((a, b) => a + b, 0));
    console.log('Totalt antall starter: ' + statistics.map((s) => s.starts).reduce((a, b) => a + b, 0));
    console.log('Totalt antall top5: ' + statistics.map((s) => s.top5).reduce((a, b) => a + b, 0));
    console.log('Totalt antall runder: ' + statistics.map((s) => s.laps).reduce((a, b) => a + b, 0));
    console.log('Totalt antall poles: ' + statistics.map((s) => s.poles).reduce((a, b) => a + b, 0));
    const maxStarts = _.max(statistics, (s) => s.starts);
    const maxWins = _.max(statistics, (s) => s.win_percentage);
    const maxTop5 = _.max(statistics, (s) => s.top5_percentage);
    const maxLaps = _.max(statistics, (s) => s.laps);
    const maxPoles = _.max(statistics, (s) => s.poles);
    const maxLapsLed = _.max(statistics, (s) => s.laps_led);
    const minLaps = _.min(statistics, (s) => s.laps);
    console.log(maxStarts.display_name + ' startet ' + maxStarts.starts + ' løp og fullførte ' + maxStarts.laps);
    console.log(maxWins.display_name + ' vant ' + maxWins.win_percentage + '% av sine ' + maxWins.starts + ' løp');
    console.log(
        maxTop5.display_name + ' kom topp 5 i ' + maxTop5.top5_percentage + '% av sine ' + maxTop5.starts + ' løp'
    );
    console.log(maxLapsLed.display_name + ' ledet ' + maxLapsLed.laps_led + ' av sine ' + maxLapsLed.laps + ' runder');
    console.log(
        maxPoles.display_name +
            ' hadde ' +
            maxPoles.poles +
            ' pole positions fordelt på ' +
            maxLapsLed.starts +
            ' starter'
    );

    console.log(maxLaps.display_name + ' kjørte ' + maxLaps.laps + ' runder');
    console.log(minLaps.display_name + ' kjørte ' + minLaps.laps + ' runder');
};
