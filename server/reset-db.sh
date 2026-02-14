#!/bin/bash
# Script to reset the database and reload all courses

echo "Resetting database..."
rm -f data/salino.db
echo "Database deleted. Restart the server to recreate it with all courses."
echo "Run: npm run dev"
