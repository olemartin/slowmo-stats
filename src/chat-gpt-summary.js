import { format } from 'date-fns-tz';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { mapLapTime } from './chart-laps.js';
import { formatLicenseForSummary } from './discord.js';
dotenv.config();

const ratingFormatter = new Intl.NumberFormat('nb-NB', { maximumFractionDigits: 0 });
const diffFormatter = new Intl.NumberFormat('nb-NB', {
    signDisplay: 'exceptZero',
});

const openai = new OpenAI({
    apiKey: process.env.OPEN_AI_API_KEY,
});

export const generateGptText = ({ laps, driver, carType, race, previousRaces }) => {
    const lapText = laps.map((lap) => {
        return ` - ${lap.lapNumber}. ${lap.position}. position, ${lap.events.join(', ') || 'clean lap'} ${
            lap.personalBestLap ? ', his fastest lap of this race' : ''
        }, time: ${mapLapTime({ lapTime: lap })}`;
    });

    const previousRacesText = previousRaces.map(
        (race) => ` - Raced at ${race.raced_at}: Incident points: ${race.incidents}, finish position: ${race.position}`
    );

    const base = `
Raced at: ${race.raceTime}
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
Safety rating difference: ${driver.sratingDifference}
Laps: 
${lapText.join('\n')}
Previous races:
${previousRacesText.join('\n')}
Number of drivers: ${race.numDrivers}
Winner: ${race.winner.name}
Fastest lap of the race: ${race.fastestLap.time} by ${race.fastestLap.name}
`;
    console.log(base);
    return base;
};

export const getRaceSummary = async ({ lapTimes, raceDetails, team, member, race, races }) => {
    if (race && raceDetails && lapTimes?.length > 0 && team && member) {
        const previousRaces = races.reverse().map((race) => ({
            position: race.finish_position_in_class + 1,
            incidents: race.incidents,
            raced_at: race.start_time,
        }));
        const data = {
            previousRaces,
            race: {
                raceTime: race.start_time,
                name: race.series_short_name,
                track: race.track.track_name,
                winner: {
                    name: raceDetails.winner?.display_name || '',
                },
                fastestLap: {
                    time: raceDetails.fastestLap
                        ? format(new Date(raceDetails.fastestLap.best_lap_time / 10), 'mm:ss.SSS')
                        : undefined,
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
                sratingDifference: formatLicenseForSummary(raceDetails.race),
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
        const text = generateGptText({
            laps: lapTimes,
            driver: data.driver,
            carType: data.carType,
            race: data.race,
            previousRaces: data.previousRaces,
        });

        try {
            const completion = await openai.chat.completions.create({
                messages: [
                    {
                        role: 'system',
                        content: `I want you to create a report of a race in iRacing. 
                        It should be mostly funny, but also informative with some insights in how the race went. Be NSFW and swearing is allowed.
                        The report should be funny and witty. If the driver does something bad, be rude and call him names. 
 Keep it short, max 400 words and 5 paragraphs. Pitting is not a bad thing. If the irating gained is positive, you should also be positive. Everything over 50 points gained is amazing!
 Focus on ${data.driver.name} and how his race progressed through the laps compared how he has performed in earlier races.`,
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
        return null;
    }
};
