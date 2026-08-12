#!/bin/bash
# Suggestions Feature Setup Script for VPS
# This script detects the database and applies the migration

set -e

echo "🚀 Suggestions Feature Setup"
echo "================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Find the scraper-hub directory
SCRAPER_DIR=""
for dir in /root/scraper-hub /root/moovie-hub /root/sync-server /opt/scraper-hub; do
    if [ -d "$dir" ]; then
        SCRAPER_DIR="$dir"
        break
    fi
done

if [ -z "$SCRAPER_DIR" ]; then
    echo -e "${RED}❌ Could not find scraper-hub directory${NC}"
    echo "Please enter the full path to your scraper-hub directory:"
    read SCRAPER_DIR
fi

echo -e "${GREEN}📁 Found scraper-hub at: $SCRAPER_DIR${NC}"
cd "$SCRAPER_DIR"
echo ""

# Check for database files
echo "🔍 Detecting database type..."
DB_TYPE=""
DB_FILE=""

if [ -f "sync.db" ]; then
    DB_TYPE="sqlite"
    DB_FILE="sync.db"
elif [ -f "database.db" ]; then
    DB_TYPE="sqlite"
    DB_FILE="database.db"
elif [ -f "data.db" ]; then
    DB_TYPE="sqlite"
    DB_FILE="data.db"
fi

if [ -n "$DB_FILE" ]; then
    echo -e "${GREEN}✅ Found SQLite database: $DB_FILE${NC}"
    DB_TYPE="sqlite"
else
    # Check for PostgreSQL
    if command -v psql &> /dev/null; then
        echo -e "${YELLOW}⚠️  PostgreSQL detected but no SQLite file found${NC}"
        echo "Do you want to use PostgreSQL? (y/n)"
        read use_pg
        if [ "$use_pg" = "y" ]; then
            DB_TYPE="postgres"
            echo "Enter your PostgreSQL database name:"
            read PG_DB
        fi
    else
        echo -e "${RED}❌ No database found!${NC}"
        exit 1
    fi
fi

echo ""
echo "📝 Creating migration SQL..."

if [ "$DB_TYPE" = "sqlite" ]; then
    # SQLite Migration
    cat > /tmp/suggestions_migration.sql << 'EOF'
-- Suggestions Feature Migration for SQLite

-- Table: suggestions
CREATE TABLE IF NOT EXISTS suggestions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prompt TEXT NOT NULL,
    placeholder TEXT DEFAULT 'Write your feedback here…',
    max_length INTEGER DEFAULT 500,
    is_active INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_suggestions_is_active ON suggestions (is_active);
CREATE INDEX IF NOT EXISTS idx_suggestions_created_at ON suggestions (created_at DESC);

-- Table: suggestion_responses
CREATE TABLE IF NOT EXISTS suggestion_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    suggestion_id INTEGER NOT NULL,
    response_text TEXT NOT NULL,
    user_fingerprint TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (suggestion_id) REFERENCES suggestions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_suggestion_responses_suggestion_id ON suggestion_responses (suggestion_id);
CREATE INDEX IF NOT EXISTS idx_suggestion_responses_created_at ON suggestion_responses (created_at DESC);
EOF

    echo -e "${GREEN}✅ SQLite migration created${NC}"
    echo ""
    echo "🔄 Applying migration to $DB_FILE..."
    
    sqlite3 "$DB_FILE" < /tmp/suggestions_migration.sql
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Migration applied successfully!${NC}"
    else
        echo -e "${RED}❌ Migration failed!${NC}"
        exit 1
    fi
    
    # Verify tables were created
    echo ""
    echo "📊 Verifying tables..."
    TABLE_COUNT=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN ('suggestions', 'suggestion_responses');")
    
    if [ "$TABLE_COUNT" = "2" ]; then
        echo -e "${GREEN}✅ Both tables created successfully!${NC}"
    else
        echo -e "${YELLOW}⚠️  Only $TABLE_COUNT table(s) found${NC}"
    fi

elif [ "$DB_TYPE" = "postgres" ]; then
    # PostgreSQL Migration
    cat > /tmp/suggestions_migration.sql << 'EOF'
-- Suggestions Feature Migration for PostgreSQL

CREATE TABLE IF NOT EXISTS suggestions (
    id BIGSERIAL PRIMARY KEY,
    prompt TEXT NOT NULL,
    placeholder TEXT DEFAULT 'Write your feedback here…',
    max_length INTEGER DEFAULT 500,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suggestions_is_active ON suggestions (is_active);
CREATE INDEX IF NOT EXISTS idx_suggestions_created_at ON suggestions (created_at DESC);

CREATE TABLE IF NOT EXISTS suggestion_responses (
    id BIGSERIAL PRIMARY KEY,
    suggestion_id BIGINT NOT NULL REFERENCES suggestions(id) ON DELETE CASCADE,
    response_text TEXT NOT NULL,
    user_fingerprint TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suggestion_responses_suggestion_id ON suggestion_responses (suggestion_id);
CREATE INDEX IF NOT EXISTS idx_suggestion_responses_created_at ON suggestion_responses (created_at DESC);
EOF

    echo -e "${GREEN}✅ PostgreSQL migration created${NC}"
    echo ""
    echo "🔄 Applying migration to PostgreSQL database: $PG_DB..."
    
    sudo -u postgres psql -d "$PG_DB" -f /tmp/suggestions_migration.sql
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Migration applied successfully!${NC}"
    else
        echo -e "${RED}❌ Migration failed!${NC}"
        exit 1
    fi
fi

echo ""
echo "🔄 Restarting PM2 services..."
pm2 restart scraper-hub

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ PM2 restarted successfully!${NC}"
else
    echo -e "${YELLOW}⚠️  PM2 restart had issues${NC}"
fi

echo ""
echo "================================"
echo -e "${GREEN}✨ Suggestions feature is now ready!${NC}"
echo ""
echo "Next steps:"
echo "1. Visit your admin panel"
echo "2. Click on the 'Suggestions & Engagement' tab"
echo "3. Create your first suggestion prompt"
echo ""
echo "Database location: $SCRAPER_DIR/$DB_FILE"
echo ""

# Clean up
rm -f /tmp/suggestions_migration.sql
