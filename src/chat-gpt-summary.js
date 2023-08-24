import { format } from 'date-fns-tz';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { mapLapTime } from './chart-laps.js';
import { formatLicense } from './discord.js';
dotenv.config();

const ratingFormatter = new Intl.NumberFormat('nb-NB', { maximumFractionDigits: 0 });
const diffFormatter = new Intl.NumberFormat('nb-NB', {
    signDisplay: 'exceptZero',
});

const openai = new OpenAI({
    apiKey: process.env.OPEN_AI_API_KEY,
});

export const generateGptText = ({ laps, driver, carType, race }) => {
    const lapText = laps.map((lap) => {
        return `${lap.lapNumber}. ${lap.position}. position, ${lap.events.join(', ') || 'clean lap'} ${
            lap.personalBestLap ? ', his fastest lap' : ''
        }, time: ${mapLapTime({ lapTime: lap })}`;
    });

    const base = `
Name of driver in focus: ${driver.name}
Name of race: ${race.name}
Incident points: ${driver.incidents}
Car: ${carType}
Track: ${race.track},
Strength of field: ${race.sof}
Driver's irating: ${driver.irating}
irating gained: ${driver.iratingDifference}
Qualified position: ${driver.qualify.position}
Finished position: ${driver.race.position}
new safety rating: ${driver.sratingDifference}
Laps: 
${lapText.join('\n')}
Number of drivers: ${race.numDrivers}
Winner: ${race.winner.name}
Fastest lap of the race: ${race.fastestLap.time} by ${race.fastestLap.name}
`;
    console.log(base);
    return base;
};

export const getRaceSummary = async ({ lapTimes, raceDetails, team, member, race }) => {
    if (race && raceDetails && lapTimes?.length > 0 && team && member) {
        const data = {
            race: {
                name: race.series_short_name,
                track: race.track.track_name,
                winner: {
                    name: raceDetails.winner?.display_name || '',
                },
                fastestLap: {
                    time: format(
                        raceDetails.fastestLap ? new Date(raceDetails.fastestLap.best_lap_time / 10) : undefined,
                        'mm:ss.SSS'
                    ),
                    name: raceDetails.fastestLap?.display_name || '',
                },
                sof: Math.round(raceDetails.sof || race.event_strength_of_field),
                numDrivers: raceDetails.classParticipants?.length,
            },
            carType: race.car_name,
            driver: {
                incidents: race.incidents,
                irating: raceDetails.race.oldi_rating,
                iratingDifference: diffFormatter.format(raceDetails.race.newi_rating - raceDetails.race.oldi_rating),
                sratingDifference: formatLicense(raceDetails.race),
                name: member.display_name,
                race: {
                    position: race.finish_position_in_class + 1,
                    sof: ratingFormatter.format(raceDetails.sof || race.event_strength_of_field),
                },
                qualify: {
                    position: race?.starting_position_in_class + 1,
                },
            },
        };
        const text = generateGptText({ laps: lapTimes, driver: data.driver, carType: data.carType, race: data.race });

        try {
            const completion = await openai.chat.completions.create({
                messages: [
                    {
                        role: 'system',
                        content: `I want you to create a report of a race in iRacing. 
                        It should be mostly funny, but also informative with some insights in how the race went. Be NSFW and swearing is allowed.
 Also include some quotes from the driver. The report should be funny and witty. If the driver does something bad, be rude and call him names. 
 Keep it short, max 400 words and 5 paragraphs.
 Focus on ${data.driver.name} and how his race progressed through the laps`,
                    },
                    { role: 'user', content: text },
                ],
                model: 'gpt-3.5-turbo',
            });

            const result = completion.choices[0].message.content;
            console.log(result);
            return result;
        } catch (e) {
            console.error('error creating gpt summary', e);
            return null;
        }
    } else {
        console.log('Not enough data');
        console.log({ lapTimes, raceDetails, team, member, race });
        return null;
    }
};
