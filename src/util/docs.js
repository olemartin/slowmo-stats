import api from '../api.js';

const response = await api.get('/data/doc');
console.log(JSON.stringify(response.data));
