const p = require('./purstream.cjs');
p.getStreams(1314481, 'movie').then(s => {
  console.log('Streams:', s.length);
}).catch(e => console.log('Err:', e.message));
