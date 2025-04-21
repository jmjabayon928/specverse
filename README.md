# 🌐 SpecVerse — Multilingual Datasheet Management System

**SpecVerse** is a full-featured, multilingual datasheet management platform designed for engineers and technical teams. It supports advanced document handling, dynamic form generation, version control, and internationalization — with future AI capabilities on the roadmap.

---

## 🚀 Key Features

- 📄 **Export to PDF & Excel** — Beautifully styled, multilingual datasheet exports
- 🌍 **Multilingual UI** — Currently supports English, French, German, Japanese (more coming)
- 🔁 **Revision & Approval Workflow** — Track, duplicate, and approve datasheet revisions
- 📦 **Subsheet-Based Architecture** — Modular templates and grouped information values
- 🔢 **Unit Conversion** — SI and USC toggle with smart value conversion
- 💾 **Database-Driven** — Powered by SQL Server with clean separation of templates and values
- 🧠 **AI-Ready Design** *(coming soon)* — Designed for future features like:
  - Smart suggestions
  - Predictive maintenance
  - Anomaly detection
  - Cost estimation from CAD data

---

## 🧱 Tech Stack

- **Frontend**: Next.js 14+, Tailwind CSS, TypeScript
- **Backend**: Node.js, Express.js, MSSQL
- **Database**: Microsoft SQL Server
- **PDF Generator**: `html-pdf-node`
- **Excel Export**: `exceljs`
- **Utilities**: `convert-units` for dynamic UOM conversion

---

## 🛠 Setup Instructions

> Clone and run locally (for development)

```bash
git clone https://github.com/jmjabayon928/specverse.git
cd specverse
npm install
npm run dev
