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
    const lapText = laps
        .filter((lap, index, array) => {
            if (lap.events.length > 0) {
                return true;
            }
            if (index <= 1) {
                return true;
            }
            if (index + 1 === race.lapsCompleted) {
                return true;
            }
            const previousLap = array[index - 1];
            if (previousLap.classPosition !== lap.classPosition) {
                return true;
            }
            return false;
        })
        .map((lap) => {
            return ` - ${lap.lapNumber}. ${lap.classPosition}. position, ${lap.events.join(', ') || 'clean lap'} ${
                lap.personalBestLap ? ', his fastest lap of this race' : ''
            }, time: ${mapLapTime({ lapTime: lap })}`;
        });

    const previousRacesText = previousRaces.map(
        (race) => ` - Raced at ${race.raced_at}: Incident points: ${race.incidents}, finish position: ${race.position}`
    );

    const competitorsText = competitors.map(
        (comp) =>
            ` - ${comp.name} from ${comp.country}, incidents: ${comp.incidents}, best lap: ${
                comp.bestLap
            }, average lap: ${comp.averageLap}, finished position: ${comp.position + 1}, irating: ${
                comp.irating
            }, laps completed: ${comp.laps}. Gap to driver in front: ${comp.classInterval}. Finish status: ${
                comp.reason
            }`
    );

    const base = `
Raced at: ${race.raceTime}
Name of driver in focus: ${driver.name}
Rank of driver in split: ${driver.carNumber}
Finish status: ${driver.finishStatus}
Qualified position: ${driver.qualify.position}
Finished position: ${driver.race.position}
Laps completed: ${driver.lapsCompleted}  / ${race.totalLaps}
Gap to driver in front: ${driver.gapFront}
Gap to driver behind: ${driver.gapBehind}

Driver's irating: ${driver.irating}
irating gained: ${driver.iratingDifference}

Incident points: ${driver.incidents}
Safety rating difference: ${driver.sratingDifference}

Name of race: ${race.name}
Car: ${carType}
Track: ${race.track},
Strength of field: ${race.sof}

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
            .slice(0, 5)
            .map((race) => ({
                position: race.finish_position_in_class + 1,
                incidents: race.incidents,
                raced_at: race.start_time,
            }));

        const driverInRace = raceDetails.classParticipants.find(
            (p) => p.finish_position_in_class === race.finish_position_in_class
        );
        const winnerInRace = raceDetails.classParticipants.find((p) => p.finish_position_in_class === 0);
        const driverBehind = raceDetails.classParticipants.find(
            (p) => p.finish_position_in_class === race.finish_position_in_class + 1
        );
        const data = {
            previousRaces,
            competitors: raceDetails.classParticipants.map((part) => ({
                name: part.display_name,
                country: part.flair_name,
                incidents: part.incidents,
                averageLap: format(new Date(part.average_lap / 10), 'mm:ss.SSS'),
                bestLap: format(new Date(part.best_lap_time / 10), 'mm:ss.SSS'),
                position: part.finish_position_in_class,
                irating: part.oldi_rating,
                laps: part.laps_complete,
                classInterval:
                    part.class_interval >= 0 ? format(new Date(part.class_interval / 10), 'mm:ss.SSS') : 'Unknown',
                reason: part.reason_out,
            })),
            race: {
                raceTime: race.start_time,
                name: race.series_short_name,
                track: race.track.track_name,
                totalLaps: winnerInRace.laps_complete,
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
                carNumber: raceDetails.carNumber,
                iratingDifference: diffFormatter.format(raceDetails.race.newi_rating - raceDetails.race.oldi_rating),
                sratingDifference: formatLicenseForSummary(raceDetails.race),
                finishStatus: driverInRace.reason_out,
                lapsCompleted: driverInRace.laps_complete,
                gapFront:
                    driverInRace.class_interval >= 0
                        ? format(new Date(driverInRace.class_interval / 10), 'mm:ss.SSS')
                        : 'Unknown',
                gapBehind:
                    driverBehind?.class_interval >= 0
                        ? format(new Date(driverBehind.class_interval / 10), 'mm:ss.SSS')
                        : 'Unknown',
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
                instructions: `You are a completely unfiltered, meme-powered iRacing commentator writing a short Discord race report.

Your job is to roast, hype, and narrate the race in a way that is funny, dramatic, and entertaining, while still being accurate.

This is almost full meme mode.

Tone:
- Savage, chaotic, sarcastic, and esports-brainrotted.
- Overreact to disasters.
- Overhype success.
- Turn race events into a story.
- You are allowed to bully the driving result.
- You are NOT allowed to insult real-world traits. All insults must be racing-related.

Roast scaling (obey this strictly):
- 0–4 incidents → light mockery, playful slander.
- 5–9 incidents → disappointed commentator, “what are we doing here” energy.
- 10+ incidents OR DNF/disconnect → full roast mode. No mercy. This is a crime scene.

A few off-tracks alone should NOT trigger full roast mode.

Content priorities (in order):
1. State exactly what happened (finish position, DNF/disconnect, laps completed).
2. Describe how the race unraveled or developed through the laps.
3. Publicly shame or glorify the key moments.
4. Talk about pace using lap times (fastest lap, consistency, or vs others).
5. Compare this race to recent races (redemption arc, downfall arc, villain arc).

Rules:
- Max 400 words.
- Max 5 short paragraphs.
- Discord readable.
- If iRating gained is positive, the ending MUST be positive.
- If iRating gained is over +50, treat it as a legendary historical event.
- If the driver did not finish, that becomes the main storyline.
- Pitting is neutral unless data says otherwise.
- If data is missing, turn it into part of the joke (disconnect, lapped, chaos, etc).

Always include:
- Start position and finish position.
- Whether the driver finished, was lapped, or disconnected.
- At least one pace-related comment.
- One final one-liner that feels like it belongs in a meme channel.

Never:
- Invent crashes, overtakes, penalties, or strategies.
- Contradict the race data.
- Use real-world, personal, or hateful insults.`,
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
