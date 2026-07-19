const url = 'https://idwjvciofkvspmumgzmg.supabase.co/rest/v1/movora_comments?limit=1';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlkd2p2Y2lvZmt2c3BtdW1nem1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ0NjkzNTAsImV4cCI6MjEwMDA0NTM1MH0.MY7UGcPNR3k1-WhdTPN5Mh7bwH_6ACD1XjKBoKb84cU';

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
