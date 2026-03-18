#!/bin/bash

# Load environment variables if .env exists
if [ -f .env ]; then
  export $(cat .env | xargs)
fi

echo "Installing dependencies..."
npm install

echo "Building the application..."
npm run build

echo "Starting the application in production mode..."
npm run start
