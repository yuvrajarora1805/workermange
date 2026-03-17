# Worker Management System

A comprehensive web application designed to track production workers, machines, attendance, and automatically optimize the daily assignment of workers to machines based on their historical efficiency scores.

## Tech Stack
- **Frontend & API**: [Next.js](https://nextjs.org/) (App Router)
- **Database**: MySQL
- **Styling**: Tailwind CSS / Custom UI with modern dark mode theme

## Core Features

1. **Dashboard & Attendance Tracking**
   - Easily mark workers as present, absent, or late for the day.
   - Workers who are present will be considered for machine allocation.

2. **Machine & Line Management**
   - Organize your factory floor by assigning Machines to specific Production Lines.
   - Maintain the positional order of machines on each line.

3. **Performance Logging**
   - **Production Logs**: Log the daily target units vs. actual units produced by each worker on their assigned machine.
   - **Manager Ratings**: Managers can provide a daily subjective rating (1-4 scale) and comments for each worker.

4. **Efficiency Calculation**
   - A fully automated scoring system that runs daily to compute every worker's efficiency.
   - Final Efficiency Score = **80% Production Score** (actual/target units capped at 100% of the 80 points) + **20% Manager Rating Score**.

5. **Smart Auto-Assignment Algorithm**
   - A one-click allocation feature that automatically assigns present workers to active machines for the shift.
   - The algorithm considers both the **overall global efficiency** of the worker AND their **historical efficiency on specific machines**.
   - It performs a Greedy match, assigning the highest scoring (worker, machine) pairs first, ensuring your most productive workers are placed on the machines they operate best.
   - Any remaining unassigned workers are placed on the "Bench".

## Database Setup

1. Create a MySQL database named `workermanage`.
2. Import the database schema and seed data:
   ```bash
   mysql -u your_username -p workermanage < schema.sql
   ```
3. Update your `.env` or `src/lib/db.js` with your MySQL connection credentials.

## Getting Started

First, install the dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Current Assignment Algorithm Details

The current auto-allocator in `src/app/api/assignments/route.js` assigns workers by calculating a "match score" for every (worker, machine) combination:
- **Global Efficiency**: Calculated over the last 30 days based on all machines operated by the worker.
- **Machine-Specific Efficiency**: Calculated over the last 60 days on that exact machine.
- **Formulas**: Match Score = 70% (Machine-Specific Score) + 30% (Global Score). If no specific history exists, it falls back purely to the Global Score. 

Workers and machines are paired by sorting these match scores descending.
