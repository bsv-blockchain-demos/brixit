# Project Overview

This repository contains a prototype application developed with significant AI-assisted code generation. The goal of this documentation is to provide a clear, concise foundation for any developer who will continue building, stabilizing, or productionizing the system.

This overview describes:
- What the project does  
- The current state of implementation  
- How the repository is structured  
- Where to find deeper documentation  
- Known limitations of the prototype  

---

## 📁 Repository Structure
<project-root>
├── docs/                      # Extended project documentation
├── public/                    # Static assets (favicon, placeholder images, robots.txt)
├── src/                       # All application source code
│   ├── components/            # Reusable UI components and feature-specific component groups
│   ├── contexts/              # React context providers and global state containers
│   ├── data/                  # Static data, configuration objects, mock data, or loaders
│   ├── hooks/                 # Custom React hooks for shared logic
│   ├── integrations/          # API integrations, external service clients, adapters
│   ├── lib/                   # Utility functions, helpers, and non-UI logic
│   ├── pages/                 # Route-level components (screen pages)
│   ├── types/                 # TypeScript type definitions and interfaces
│   ├── App.css                # Global styling for the app container
│   ├── App.tsx                # Root-level application component
│   ├── index.css              # Global stylesheet
│   └── main.tsx               # Application entry point (React root, mounting logic)
├── supabase/                  # Supabase client, seeds, migrations, and edge functions
└── README.md                  # Project overview

See the [`docs`](docs/) folder for detailed documentation.

---

## ⚠ Prototype Disclaimer

This repository contains AI-generated code. Some components may:
- Include duplicated or unused logic  
- Contain mismatched interfaces or assumptions  
- Lack validation or error-handling  
- Require architectural cleanup  

See **AI Caveats & Risk Areas** for details.

---

# Sweet Earth Mapper — Prototype

This repository contains a prototype geospatial data-collection web application built primarily with AI-assisted development (Lovable, ChatGPT, Claude, Gemini, and Cursor). The project uses:

- **React + TypeScript** (Lovable-generated structure)
- **Supabase** (database, auth, edge functions, migrations)
- **Mapbox** (maps + geocoding)
- **Lovable hosting** (preview + production environments)

This documentation exists so another developer can confidently continue the project. I hear you (because yes this documentation is also mostly AI-generated, but I'm not writing markdown from scratch. And you got this!)

---

## 🚀 Project Overview

The application allows users (primarily citizen scientists worldwide) to create submissions for [BRIX](https://en.wikipedia.org/wiki/Brix) bionutrient data. There's more information in the [`Design Perspective doc`](docs/Design_Perspective). Admin users have additional management tools for reviewing submissions.

All data is stored in **Supabase Postgres**, with business logic implemented through:
- SQL functions
- Database triggers
- Supabase Edge Functions
- Row-Level Security policies
- Supabase auth templates

Front-end components were generated within Lovable but organized in `src/` similar to a typical React project.

--- 

## 🧠 Important Notes for Future Developers
- **Local development is optional.**
    - Supabase migrations can be run locally, but the canonical database is the hosted one.

- **Edge functions are NOT stored locally.**
    - They are deployed directly in Supabase; names and purposes are documented in [`docs/Supabase.md`](docs/Supabase.md).

- **Database logic (triggers + SQL functions) is extremely important for the app to function.** 

- **Lovable** automatically pushes to Github, which has a trigger to push to Gitlab. The Gitlab trigger isn't being maintained and I think broken at this point, but it exists and just needs to be cleaned up. It's a pull trigger from Gitlab because of money reasons. 

---

## 📚 Additional Documentation
All extended documentation is in [`docs/`](docs/)
- [AI Assistance](docs/AI_Assistance.md) - notes for working with the AI-driven workflow used in development
- [Architecture](docs/Architecture.md)  - Application structure, folders, front-end architecture
- [Design Perspective](docs/Design_Perspective.md)  - User journey, client perspective and overall design philosophy thus far
- [Original Lovable README](docs/Lovable_Original_README.md) - The original Lovable-generated Readme
- [Roadmap](docs/Roadmap.md)  - Current bugs, future steps, general direction from meetings thus far
- [Supabase](docs/Supabase.md)  - Database schema, migrations, functions, secrets, triggers, edge functions, and SQL reference 
