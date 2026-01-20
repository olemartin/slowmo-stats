import api from '../api.js';

const response = await api.get('/data/track/assets');
console.log(JSON.stringify(response.data));
