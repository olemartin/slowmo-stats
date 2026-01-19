import { format, formatInTimeZone } from 'date-fns-tz';
import nb from 'date-fns/locale/nb/index.js';
import { chartCustomData } from './chart.js';
import axios from 'axios';

const safetyFormatter = new Intl.NumberFormat('nb-NB', {
    signDisplay: 'exceptZero',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});
const safetyMajorFormatter = new Intl.NumberFormat('nb-NB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});
const diffFormatter = new Intl.NumberFormat('nb-NB', {
    signDisplay: 'exceptZero',
});

const ratingFormatter = new Intl.NumberFormat('nb-NB', { maximumFractionDigits: 0 });

const mapLicense = (license) => {
    if (license <= 4) {
        return 'R';
    }
    if (license <= 8) {
        return 'D';
    }
    if (license <= 12) {
        return 'C';
    }
    if (license <= 16) {
        return 'B';
    }
    if (license <= 20) {
        return 'A';
    }
    return 'P';
};
export const formatLicenseForSummary = (race) => {
    const newLic = mapLicense(race.new_license_level);
    const oldLic = mapLicense(race.old_license_level);
    const newSub = race.new_sub_level;
    const oldSub = race.old_sub_level;

    if (newLic === oldLic) {
        return safetyFormatter.format((newSub - oldSub) / 100.0);
    }
    return `From ${oldLic} ${safetyMajorFormatter.format(oldSub / 100.0)} to ${newLic} ${safetyMajorFormatter.format(
        newSub / 100.0
    )}`;
};
export const formatLicense = (race) => {
    const newLic = mapLicense(race.new_license_level);
    const oldLic = mapLicense(race.old_license_level);
    const newSub = race.new_sub_level;
    const oldSub = race.old_sub_level;

    if (newLic === oldLic) {
        return `${newLic} ${safetyMajorFormatter.format(newSub / 100.0)} (${safetyFormatter.format(
            (newSub - oldSub) / 100.0
        )})`;
    }
    return `${oldLic} ${safetyMajorFormatter.format(oldSub / 100.0)} ${
        newLic > oldLic ? '↘' : '↗'
    } ${newLic} ${safetyMajorFormatter.format(newSub / 100.0)}`;
};

const getQualifyingEmbeds = ({ race, member, raceDetails, qualLap, poleposition, positionEmoji }) => {
    return [
        {
            title: `${race.series_short_name} driven at ${race.track.track_name}`,
            url: `https://members.iracing.com/membersite/member/EventResult.do?subsessionid=${race.subsession_id}&custid=${member.cust_id}`,
            fields: [
                {
                    name: 'Driver',
                    value: `**${member.display_name}**`,
                    inline: true,
                },
                {
                    name: 'Car',
                    value: race.car_name,
                    inline: true,
                },
                {
                    name: 'Type',
                    value: race.event_type_name,
                    inline: true,
                },
                {
                    name: 'Position',
                    value: positionEmoji || `${race.finish_position_in_class + 1}.`,
                    inline: true,
                },
                {
                    name: 'Laps Completed',
                    value: ratingFormatter.format(raceDetails.qualifying?.laps_complete),
                    inline: true,
                },
                {
                    name: 'Incs',
                    value: race.incidents,
                    inline: true,
                },
                {
                    name: 'Qualifying',
                    value: `${qualLap ? format(qualLap, 'mm:ss.SSS') : 'Ingen tid'}`,
                    inline: true,
                },
                { name: '', value: '' },
                {
                    name: 'Pole position',
                    value: `${raceDetails.poleposition?.display_name} (${ratingFormatter.format(
                        raceDetails?.poleposition?.newi_rating
                    )})`,
                    inline: true,
                },
                {
                    name: 'Time',
                    value: `${poleposition ? format(poleposition, 'mm:ss.SSS') : ''}`,
                    inline: true,
                },
                { name: 'Result', value: '' },
                {
                    name: 'License',
                    value: formatLicense(raceDetails.qualifying),
                    inline: true,
                },
            ],
            footer: {
                text: `At ${formatInTimeZone(new Date(race.start_time), 'Europe/Oslo', 'eeee dd.MM.yyyy, HH:mm')}`,
            },
        },
    ];
};

const getRaceEmbeds = ({
    race,
    member,
    splitInformation,
    raceDetails,
    bestAverage,
    poleposition,
    fastestLap,
    positionEmoji,
    bestLap,
    averageLap,
    qualLap,
}) => {
    return [
        {
            title: `${race.event_type_name} in ${race.series_short_name} driven at ${race.track.track_name}`,
            url: `https://members.iracing.com/membersite/member/EventResult.do?subsessionid=${race.subsession_id}&custid=${member.cust_id}`,
            fields: [
                {
                    name: 'Driver',
                    value: `**${member.display_name}**`,
                    inline: true,
                },
                {
                    name: 'Car',
                    value: race.car_name,
                    inline: true,
                },
                ...(splitInformation
                    ? [
                          {
                              name: `Split: ${splitInformation.splitId}/${splitInformation.splits}`,
                              value: `SOF: ${ratingFormatter.format(raceDetails.sof || race.event_strength_of_field)}`,
                              inline: true,
                          },
                      ]
                    : []),
                ...(raceDetails.carNumber
                    ? [
                          {
                              name: 'Car number',
                              value: raceDetails.carNumber,
                              inline: true,
                          },
                      ]
                    : []),
                ...(race?.starting_position_in_class >= 0
                    ? [
                          {
                              name: 'Grid position',
                              value: `${race.starting_position_in_class + 1}.`,
                              inline: true,
                          },
                      ]
                    : []),
                {
                    name: 'Finish position',
                    value: positionEmoji || `${race.finish_position_in_class + 1}.`,
                    inline: true,
                },
                {
                    name: 'Laps completed',
                    value: ratingFormatter.format(race?.laps_complete || raceDetails.qualifying?.laps_complete),
                    inline: true,
                },
                {
                    name: 'Laps led',
                    value: ratingFormatter.format(race.laps_led),
                    inline: true,
                },
                {
                    name: 'Incs',
                    value: race.incidents,
                    inline: true,
                },
                {
                    name: 'Best lap',
                    value: `${bestLap ? format(bestLap, 'mm:ss.SSS') : ''}`,
                    inline: true,
                },
                {
                    name: 'Average',
                    value: `${averageLap ? format(averageLap, 'mm:ss.SSS') : ''}`,
                    inline: true,
                },
                {
                    name: 'Qualifying',
                    value: `${qualLap ? format(qualLap, 'mm:ss.SSS') : 'Ingen tid'}`,
                    inline: true,
                },
                { name: '', value: '' },
                {
                    name: 'Pole position',
                    value: `${raceDetails.poleposition?.display_name} (${ratingFormatter.format(
                        raceDetails?.poleposition?.newi_rating
                    )})`,
                    inline: true,
                },
                {
                    name: 'Time',
                    value: `${poleposition ? format(poleposition, 'mm:ss.SSS') : ''}`,
                    inline: true,
                },
                { name: '', value: '' },
                {
                    name: 'Winner',
                    value: `${raceDetails.winner?.display_name || ''} (${ratingFormatter.format(
                        raceDetails.winner?.newi_rating || ''
                    )})`,
                    inline: true,
                },
                {
                    name: 'Average',
                    value: `${bestAverage ? format(bestAverage, 'mm:ss.SSS') : ''}`,
                    inline: true,
                },

                { name: '', value: '' },
                {
                    name: 'Fastest lap',
                    value: `${raceDetails.fastestLap?.display_name || ''} (${ratingFormatter.format(
                        raceDetails.fastestLap?.newi_rating || ''
                    )})`,
                    inline: true,
                },
                {
                    name: 'Time',
                    value: `${fastestLap ? format(fastestLap, 'mm:ss.SSS') : ''}`,
                    inline: true,
                },
                { name: 'Result', value: '' },
                {
                    name: 'License',
                    value: `${
                        raceDetails.race
                            ? formatLicense(raceDetails.race)
                            : raceDetails.qualifying
                            ? formatLicense(raceDetails.qualifying)
                            : ''
                    }`,
                    inline: true,
                },
                ...(raceDetails.race
                    ? [
                          {
                              name: 'iRating',
                              value: `${ratingFormatter.format(raceDetails.race.newi_rating)} (${diffFormatter.format(
                                  raceDetails.race.newi_rating - raceDetails.race.oldi_rating
                              )})`,
                              inline: true,
                          },
                      ]
                    : []),
            ],
            footer: {
                text: `At ${formatInTimeZone(new Date(race.start_time), 'Europe/Oslo', 'eeee dd.MM.yyyy, HH:mm')}`,
            },
        },
    ];
};

function getEmbeds(race, member, splitInformation, raceDetails) {
    const positionEmoji =
        race.finish_position_in_class === 0
            ? `🥇`
            : race.finish_position_in_class === 1
            ? `🥈`
            : race.finish_position_in_class === 2
            ? '🥉'
            : undefined;
    const poleposition = raceDetails.poleposition
        ? new Date(raceDetails.poleposition.best_qual_lap_time / 10)
        : undefined;
    const qualLap = raceDetails.qualifying ? new Date(raceDetails.qualifying.best_qual_lap_time / 10) : undefined;

    if (race.event_type === 5) {
        const bestLap = raceDetails.race ? new Date(raceDetails.race.best_lap_time / 10) : undefined;
        const averageLap = raceDetails.race ? new Date(raceDetails.race.average_lap / 10) : undefined;
        const fastestLap = raceDetails.fastestLap ? new Date(raceDetails.fastestLap.best_lap_time / 10) : undefined;
        const bestAverage = raceDetails.winner ? new Date(raceDetails.winner.average_lap / 10) : undefined;
        return getRaceEmbeds({
            race,
            positionEmoji,
            member,
            splitInformation,
            raceDetails,
            poleposition,
            bestAverage,
            fastestLap,
            bestLap,
            averageLap,
            qualLap,
        });
    } else {
        return getQualifyingEmbeds({ race, member, raceDetails, positionEmoji, qualLap, poleposition });
    }
}

export const postToDiscord = async ({ race, raceDetails, splitInformation, member, team, chartData, raceSummary }) => {
    const instance = axios.create();
    const embeds = getEmbeds(race, member, splitInformation, raceDetails);
    const charts =
        chartData.positionChart && chartData.laptimeChart
            ? [
                  { image: { url: await chartCustomData({ chart: chartData.positionChart }) } },
                  { image: { url: await chartCustomData({ chart: chartData.laptimeChart }) } },
              ]
            : [];

    if (process.env[team.discordUrl]) {
        const discordData = {
            username: `${team.teamName} racebot`,
            title: `${team.memberName} has raced`,
            avatar_url: 'https://cdn-icons-png.flaticon.com/512/65/65578.png',
            embeds: [...embeds, ...charts, ...(raceSummary ? [{ title: 'Summary', description: raceSummary }] : [])],
        };
        await instance.post(process.env[team.discordUrl], discordData);
    }
};
