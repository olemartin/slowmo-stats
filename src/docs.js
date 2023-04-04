import { auth } from './auth.js';

const instance = await auth();
const response = await instance.get('/data/doc');
console.log(JSON.stringify(response.data));
