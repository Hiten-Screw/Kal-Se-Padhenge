# IntelLIDivide
An Intelligent Natural Language Expense Management System

## Overview
IntelLIDivide is an automated expense management platform designed for shared financial environments such as shared housing or group travel. The system eliminates manual form-based expense entry by using Natural Language Processing (NLP) to convert conversational text or voice input into structured financial records. It provides real-time balance calculations, transparent debt tracking, and synchronized group views.

---

## Problem Statement
Existing shared expense trackers rely heavily on manual input, leading to friction, delayed updates, and inaccurate settlements. IntelLIDivide addresses these issues through AI-powered data extraction and real-time synchronization.

---

## Features

### NLP-Based Expense Entry
- Extracts amount, category, and description from unstructured text or voice input
- Eliminates manual form filling

### Voice Input Support
- Browser-based speech-to-text using Web Speech API
- Enables hands-free expense logging

### Relational Debt Management
- Tracks individual contributions and shared liabilities
- Provides instant net balance computation

### Real-Time Synchronization
- Uses Supabase Realtime (WebSockets)
- Ensures immediate balance updates across all group members

### Authentication and Access Control
- Secure JWT-based authentication via Supabase Auth
- Group-level data isolation

### Expense Categorization and Analytics
- Automatic tagging of expenses
- Aggregated insights into group spending patterns

---

## System Architecture


---

## Tech Stack

### Frontend
- HTML5, CSS3
- Tailwind CSS
- JavaScript (ES6+)

### Intelligence Layer
- Google Gemini 1.5 Flash
- Named Entity Recognition and JSON structuring

### Voice Processing
- Web Speech API

### Backend
- Supabase (PostgreSQL)
- Supabase Realtime
- Supabase Auth (JWT)

### Deployment
- Vercel or Netlify

---

## Setup Instructions

### Clone Repository
```bash
git clone https://github.com/your-username/IntelLIDivide.git
cd IntelLIDivide