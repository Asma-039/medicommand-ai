# Frontend Guide — MediCommand AI

## 1. Frontend Overview

MediCommand AI is an AI-powered hospital command center designed to provide a centralized interface for viewing and managing hospital-related information. The frontend allows users to interact with the application's available dashboards, patient-related workflows, and other implemented features.

The frontend is built using React, TypeScript, and Vite. It provides the user interface and connects to backend services where configured.

## 2. Technology Stack

| Technology | Purpose |
|---|---|
| React | Builds the user interface using reusable components. |
| TypeScript | Adds static typing to JavaScript code. |
| Vite | Provides the development server and production build tools. |
| CSS and configured styling tools | Control the appearance and layout of the application. |
| Supabase | Provides database and backend services where configured. |

## 3. Project Structure

The main frontend files include:

- `src/App.tsx` — Main application component and interface composition.
- `src/AdmitForm.tsx` — Component associated with the patient admission form.
- `src/main.tsx` — Entry point that initializes and renders the React application.
- `src/index.css` — Global styling for the interface.
- `src/lib/` — Supporting modules, including Supabase configuration, types, and view-related logic where implemented.
- `index.html` — HTML entry page used by Vite.
- `package.json` — Project metadata, dependencies, and npm scripts.
- `vite.config.ts` — Vite configuration.

The exact responsibilities of each module should be confirmed by inspecting its implementation.

## 4. React Components

React divides the interface into reusable components.

### App.tsx

`App.tsx` serves as the main application component. It brings together the interface and the components required by the application.

### AdmitForm.tsx

`AdmitForm.tsx` contains the admission-form interface. Its actual fields, validation rules, submission behavior, and database operations should be documented from the source code.

### main.tsx

`main.tsx` initializes the React application and renders the root component into the HTML page.

## 5. Admission Form Workflow

The admission form is intended to support the patient admission workflow.

A typical workflow may involve:

1. Opening the admission form.
2. Entering the required patient information.
3. Validating the input, where validation is implemented.
4. Submitting the form.
5. Processing the submission and displaying feedback.

The exact fields, validation rules, database operations, and success or error messages must be verified against `src/AdmitForm.tsx` and the related modules.

## 6. Application Entry Point

The browser loads `index.html`, which provides the HTML element used to mount the React application.

The Vite configuration determines how the application is served during development and built for production. The `main.tsx` entry point initializes React and renders the main application component.

## 7. Supabase Integration

The project includes supporting modules under `src/lib/`, including `supabase.ts`.

Supabase can provide database access and backend services to the frontend. The actual client configuration and operations should be verified in the source code.

Configuration values should be supplied through the project's expected environment variables. Never commit real passwords, access tokens, or secret keys to the repository.

## 8. User Interface and Styling

The frontend styling includes `src/index.css` and any additional styling tools configured by the project.

The styling controls the appearance, spacing, typography, colors, and layout of the interface. Responsive behavior and accessibility features should be described according to what is actually implemented.

## 9. Installation and Execution

### Prerequisites

- Node.js
- npm
- Access to the project repository
- Any required environment configuration for connected services

### Install dependencies

Run the following command from the project root:

```bash
npm install
```

### Start the development server

```bash
npm run dev
```

Vite displays the local development URL in the terminal. Open that URL in a browser to use the application.

### Production build

If the `package.json` defines the standard Vite build script, run:

```bash
npm run build
```

Use the scripts actually defined in `package.json` if they differ from these examples.

## 10. Error Handling and Testing

The frontend should be tested by opening the application and checking the implemented workflows.

Suggested manual checks include:

- Confirming that the main interface loads.
- Navigating through the available screens.
- Entering valid and invalid admission-form data.
- Checking the behavior of form submission.
- Confirming database operations where configured.
- Observing loading states, validation messages, and error feedback where implemented.

These are suggested manual checks, not a claim that automated tests already exist.

## 11. Future Improvements

Possible future enhancements include:

- Stronger and more consistent form validation.
- More reusable React components.
- Improved accessibility and keyboard navigation.
- Automated component and integration tests.
- Clearer loading indicators and error messages.
- Better frontend documentation and maintenance practices.

These are potential improvements rather than claims about existing functionality.

## 12. Conclusion

The frontend provides the user-facing interface for MediCommand AI. React and TypeScript support the component structure, while Vite supports development and production builds. The frontend works with configured backend services to support the application's implemented hospital-management workflows.

The source code remains the authoritative reference for the exact behavior and capabilities of each component.
