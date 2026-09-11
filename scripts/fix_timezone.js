const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walk(dirPath, callback) : callback(path.join(dir, f));
    });
}

const fixDate = (filePath) => {
    if (!filePath.endsWith('.js') && !filePath.endsWith('.jsx')) return;
    
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // 1. Replace getting the hour/minutes from generic new Date() for shift logic:
    // hour = new Date().getHours();
    // n.getHours()
    // It's safer to just inject a timezone-aware Date definition wherever `const n = new Date();` or `new Date().getHours()` is used for shift logic.

    // Let's replace `const n = new Date();` when followed by `if (n.getHours() < 7`
    content = content.replace(/const n = new Date\(\);\s*if \(n\.getHours\(\) < 7/g, 
        'const n = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));\n            if (n.getHours() < 7');

    // 2. Replace `date = n.toISOString().split('T')[0];`
    content = content.replace(/n\.toISOString\(\)\.split\('T'\)\[0\]/g,
        'n.toLocaleDateString("en-CA")'); // en-CA gives YYYY-MM-DD
    
    // 3. Replace `const hour = new Date().getHours();`
    content = content.replace(/const hour = new Date\(\)\.getHours\(\);/g,
        'const hour = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"})).getHours();');

    // 4. Replace new Date().toISOString().split('T')[0]
    content = content.replace(/new Date\(\)\.toISOString\(\)\.split\('T'\)\[0\]/g,
        'new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"})).toLocaleDateString("en-CA")');
        
    // 5. Replace date.toISOString().split('T')[0]
    content = content.replace(/date\.toISOString\(\)\.split\('T'\)\[0\]/g,
        'new Date(date.toLocaleString("en-US", {timeZone: "Asia/Kolkata"})).toLocaleDateString("en-CA")');

    // 6. Replace d.toISOString().split('T')[0]
    content = content.replace(/d\.toISOString\(\)\.split\('T'\)\[0\]/g,
        'new Date(d.toLocaleString("en-US", {timeZone: "Asia/Kolkata"})).toLocaleDateString("en-CA")');

    // 7. Fix `(hour === 7 && new Date().getMinutes() >= 30)` which still uses generic new Date()
    content = content.replace(/new Date\(\)\.getMinutes\(\)/g,
        'new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"})).getMinutes()');

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Fixed:', filePath);
    }
};

walk(path.join(__dirname, '..', 'src'), fixDate);
console.log('Done');
