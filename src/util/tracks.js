import { auth } from '../auth.js';

const instance = await auth();
const response = await instance.get('/data/track/assets');
console.log(JSON.stringify(response.data));
