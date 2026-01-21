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

export const generateGptText = ({ laps, driver, carType, race, previousRaces, competitors }) => {
    const lapText = laps.map((lap) => {
        return ` - ${lap.lapNumber}. ${lap.classPosition}. position, ${lap.events.join(', ') || 'clean lap'} ${
            lap.personalBestLap ? ', his fastest lap of this race' : ''
        }, time: ${mapLapTime({ lapTime: lap })}`;
    });

    const previousRacesText = previousRaces.map(
        (race) => ` - Raced at ${race.raced_at}: Incident points: ${race.incidents}, finish position: ${race.position}`
    );

    const competitorsText = competitors.map(
        (comp) =>
            ` - ${comp.name} from ${comp.country}, incidents: ${comp.incidents}, best lap: ${comp.bestLap}, average lap: ${comp.averageLap}, finished position: ${comp.position}, irating: ${comp.irating}, laps completed: ${comp.laps}`
    );

    const base = `
Raced at: ${race.raceTime}
Name of driver in focus: ${driver.name}
Origin of driver in focus: ${driver.country}
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
Competitors:
${competitorsText.join('\n')}
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
        const previousRaces = races
            .slice(1)
            .reverse()
            .map((race) => ({
                position: race.finish_position_in_class + 1,
                incidents: race.incidents,
                raced_at: race.start_time,
            }));

        const data = {
            previousRaces,
            competitors: raceDetails.classParticipants.map((part) => ({
                name: part.display_name,
                country: part.flair_name,
                incidents: part.incidents,
                averageLap: format(new Date(part.average_lap / 10), 'mm:ss.SSS'),
                bestLap: format(new Date(part.best_lap_time / 10), 'mm:ss.SSS'),
                position: part.position,
                irating: part.oldi_rating,
                laps: part.laps_complete,
            })),
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
                numDrivers: raceDetails.classParticipants?.length || raceDetails.allParticipants?.length,
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
            competitors: data.competitors,
            previousRaces: data.previousRaces,
        });

        try {
            const response = await openai.responses.create({
                instructions: `I want you to create a report of a race in iRacing. 
                        It should be mostly funny, but also informative with some insights in how the race went. 
                        The report should be funny and witty. If the driver does something bad, be rude and call him names. 
 Keep it short, max 400 words and 5 paragraphs. Pitting is not a bad thing. If the irating gained is positive, you should also be positive. 
 Everything over 50 points gained is amazing!
 Focus on ${data.driver.name} and how his race progressed through the laps compared to how he has performed in earlier races. 
 Compare the driver's laptimes to each other, and to other drivers`,
                input: text,
                model: 'gpt-5.1',
            });

            const result = response.output_text;
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
