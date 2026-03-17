const mysql = require('mysql2/promise');
const fs = require('fs');

async function debugSchema() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'workermanage'
    });

    try {
        const [rows] = await connection.query('SHOW CREATE TABLE daily_assignments');
        fs.writeFileSync('daily_assignments_schema.txt', rows[0]['Create Table']);
        console.log('Schema written to daily_assignments_schema.txt');

        const [indexes] = await connection.query('SHOW INDEX FROM daily_assignments');
        fs.writeFileSync('daily_assignments_indexes.json', JSON.stringify(indexes, null, 2));
        console.log('Indexes written to daily_assignments_indexes.json');

        const [fk_info] = await connection.query(`
            SELECT 
                TABLE_NAME, 
                COLUMN_NAME, 
                CONSTRAINT_NAME, 
                REFERENCED_TABLE_NAME, 
                REFERENCED_COLUMN_NAME
            FROM 
                INFORMATION_SCHEMA.KEY_COLUMN_USAGE
            WHERE 
                (TABLE_NAME = 'daily_assignments' OR REFERENCED_TABLE_NAME = 'daily_assignments')
                AND REFERENCED_TABLE_NAME IS NOT NULL
        `);
        fs.writeFileSync('daily_assignments_fk_info.json', JSON.stringify(fk_info, null, 2));
        console.log('FK info written to daily_assignments_fk_info.json');

    } finally {
        await connection.end();
    }
}

debugSchema();
