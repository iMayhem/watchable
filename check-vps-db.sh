#!/bin/bash
# VPS Database Migration Helper
# Run this on your VPS to check database and apply suggestions migration

echo "🔍 Checking VPS Database Setup..."
echo ""

# Check if PostgreSQL is installed
if command -v psql &> /dev/null; then
    echo "✅ PostgreSQL is installed"
    psql --version
    echo ""
    
    # Try to connect and check database
    echo "📊 Checking database..."
    sudo -u postgres psql -c "\l" 2>/dev/null || echo "⚠️  Need to check postgres user/permissions"
    echo ""
fi

# Check if SQLite is being used
if [ -f "database.db" ] || [ -f "sync.db" ] || [ -f "data.db" ]; then
    echo "✅ SQLite database file found:"
    ls -lh *.db 2>/dev/null
    echo ""
fi

# Check PM2 processes
echo "🔄 PM2 Processes:"
pm2 list
echo ""

# Check for database config in project
echo "📁 Checking for database config files..."
find /root -name "*.db" -o -name "database.json" -o -name "knexfile.js" 2>/dev/null | head -5
echo ""

echo "===================="
echo "Next Steps:"
echo "1. Identify the database type (PostgreSQL or SQLite)"
echo "2. If PostgreSQL: Run the migration SQL file"
echo "3. If SQLite: Convert the migration to SQLite syntax and run it"
echo ""
echo "To run PostgreSQL migration:"
echo "  sudo -u postgres psql -d YOUR_DB_NAME -f /path/to/suggestions_migration.sql"
echo ""
echo "To check tables in PostgreSQL:"
echo "  sudo -u postgres psql -d YOUR_DB_NAME -c '\dt'"
echo ""
