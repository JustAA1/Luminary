# Luminary

Luminary is a personalized learning track application. Built with a modern Next.js frontend, it ingests user profiles and dynamically produces ordered topic roadmaps to guide your learning journey.

## Features

- **Personalized Onboarding**: Create a user profile with your skills, interests, and field of study to generate a customized learning roadmap.
- **Dynamic Learning Paths**: Topics are logically ordered and visually presented to adapt to your progress.
- **Interactive Web UI**: A beautiful, responsive Next.js frontend with animations that provides a seamless interface to view, navigate, and manage learning progress.
- **AI-Powered**: Integrates with Google Generative AI to enhance the learning experience.
- **Data Persistence**: Uses Supabase for durable, production-ready storage of user states and roadmaps.

## Prerequisites

- **Node.js** (v18+ recommended)
- **Supabase** (For database storage and authentication)

## Installation

Install the project dependencies via npm:

```bash
# From the root of the project (Luminary/)
npm install
pip install -r requirements.txt
```

## Environment Setup

To connect to your database and AI services, create a `.env.local` file at the root of the project with the following variables:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
GEMINI_API_KEY=your_gemini_api_key
SLIDES_API_KEY=your_slides_api_key
YOUTUBE_API_KEY=your_youtube_api_key
```

## Running the Application

To start the Next.js development server:

```bash
npm run dev
```

The website will be available at [http://localhost:3000](http://localhost:3000).

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (React)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Database & Auth**: [Supabase](https://supabase.com/)
- **AI**: Google Generative AI (`@google/generative-ai`)
- **Animations**: Anime.js
- **Icons**: Lucide React
