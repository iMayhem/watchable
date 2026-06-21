const url = 'https://eeyiragtylotiwozbgqp.supabase.co/rest/v1/movora_comments?limit=1';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVleWlyYWd0eWxvdGl3b3piZ3FwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzNzAyNzYsImV4cCI6MjA5NDk0NjI3Nn0.YB_alc7kt5l09eTfNH0x5q-ayBx-dHS1qE-yzHbRTFg';

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
