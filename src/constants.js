import api from './api.js';

const response = await api.get('/data/lookup/get?weather=weather_preciperation_option');
console.log(response.data);
const data = await api.get(response.data.link);
console.log(JSON.stringify(data.data));
