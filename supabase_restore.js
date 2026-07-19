import fs from 'fs';
import readline from 'readline';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const askQuestion = (query) => new Promise((resolve) => rl.question(query, resolve));

async function main() {
    console.log('=========================================');
    console.log('WATCHABLE SUPABASE RESTORE UTILITY');
    console.log('=========================================');

    // 1. Ask for Supabase URL and Service Role Key
    const newUrl = (await askQuestion('Enter your new Supabase Project URL (e.g. https://xxxx.supabase.co): ')).trim();
    const newServiceKey = (await askQuestion('Enter your new Project service_role Key (NOT anon key!): ')).trim();

    if (!newUrl || !newServiceKey) {
        console.error('❌ Project URL and service_role Key are required to restore data.');
        rl.close();
        process.exit(1);
    }

    // 2. Read backup file
    console.log('\nReading supabase_full_data_backup.json...');
    let backupData;
    try {
        const fileContent = fs.readFileSync('supabase_full_data_backup.json', 'utf8');
        backupData = JSON.parse(fileContent);
    } catch (err) {
        console.error('❌ Failed to read supabase_full_data_backup.json. Make sure the file exists in this directory.', err.message);
        rl.close();
        process.exit(1);
    }

    const tables = Object.keys(backupData);
    console.log(`Found ${tables.length} tables in backup file.`);

    // 3. Confirm restore
    const confirm = await askQuestion('\n⚠️ WARNING: This will upload all backup data to your new Supabase database. Existing rows with matching primary keys will be updated/skipped. Proceed? (y/n): ');
    if (confirm.toLowerCase() !== 'y') {
        console.log('Cancelled.');
        rl.close();
        process.exit(0);
    }

    // 4. Restore each table
    const restBase = `${newUrl.replace(/\/$/, '')}/rest/v1/`;

    for (const table of tables) {
        const rows = backupData[table];
        if (!rows || rows.length === 0) {
            console.log(`\nTable "${table}" has 0 rows. Skipping.`);
            continue;
        }

        console.log(`\nRestoring table "${table}" (${rows.length} rows)...`);
        
        // Upload in batches of 100 to prevent payload size limits
        const batchSize = 100;
        let successful = 0;

        for (let i = 0; i < rows.length; i += batchSize) {
            const batch = rows.slice(i, i + batchSize);
            try {
                const res = await fetch(`${restBase}${table}`, {
                    method: 'POST',
                    headers: {
                        'apikey': newServiceKey,
                        'Authorization': `Bearer ${newServiceKey}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'resolution=merge-duplicates' // Upsert: merge/overwrite on conflict
                    },
                    body: JSON.stringify(batch)
                });

                if (res.ok) {
                    successful += batch.length;
                    process.stdout.write(`  Uploaded ${successful}/${rows.length} rows...\r`);
                } else {
                    const text = await res.text();
                    console.error(`\n  ⚠️ Batch [${i}-${i+batch.length}] failed: status ${res.status} - ${text}`);
                }
            } catch (err) {
                console.error(`\n  ❌ Connection error on batch [${i}-${i+batch.length}]:`, err.message);
            }
        }
        console.log(`\n  ✅ Done. Successfully uploaded ${successful}/${rows.length} rows.`);
    }

    console.log('\n=========================================');
    console.log('🎉 RESTORATION PROCESS COMPLETED!');
    console.log('=========================================');
    rl.close();
}

main().catch(err => {
    console.error('Fatal error during restore:', err);
    rl.close();
    process.exit(1);
});
