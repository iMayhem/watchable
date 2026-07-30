const url = 'https://jagmmmnxgbinlugxeinc.supabase.co/rest/v1/movora_comments?limit=1';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImphZ21tbW54Z2Jpbmx1Z3hlaW5jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0NDExOTcsImV4cCI6MjA5OTAxNzE5N30.9oLJOU-HTk-YnhSckPxe_UnBG2yFIT9quAt_mYnMZH4';

fetch(url, {
    headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
    }
})
.then(res => res.json())
.then(data => {
    console.log('Columns:', data ? Object.keys(data[0] || {}) : 'no data');
    console.log('Data sample:', data);
    process.exit(0);
})
.catch(err => {
    console.error(err);
    process.exit(1);
});
