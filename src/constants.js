import { auth } from './auth.js';

const instance = await auth();
const response = await instance.get('/data/lookup/get?weather=weather_preciperation_option');
console.log(response.data);
const data = await instance.get(response.data.link);
console.log(JSON.stringify(data.data));
