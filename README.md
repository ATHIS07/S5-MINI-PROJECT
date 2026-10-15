# CloudPulse — Cloud-Based Employee Productivity & Goal Management System

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Architecture: 3-Tier Enterprise](https://img.shields.io/badge/Architecture-3--Tier%20Enterprise-emerald.svg)]()
[![AWS: API Gateway & Cognito Ready](https://img.shields.io/badge/AWS-API%20Gateway%20%26%20Cognito-orange.svg)]()
[![UI/UX Pro Max: Standard](https://img.shields.io/badge/Design-UI%2FUX%20Pro%20Max-indigo.svg)]()

CloudPulse is a cloud-native, enterprise-grade employee productivity, task orchestration, and strategic goal (OKR) governance platform. It implements a strict **3-Tier Organizational Hierarchy**:
1. **Head (Executive)**: Establishes strategic OKRs, assigns high-level directives to Team Managers, and governs org-wide capacity.
2. **Team Manager**: Receives executive directives from Head, distributes concrete work packages to engineers, approves submissions, and conducts 1-on-1 reviews.
3. **Employee (Individual Contributor)**: Executes distributed work packages, logs deep work telemetry via an interactive focus clock, and submits progress check-ins.

---

## 🚀 Key Enhancements in Version 2.0

### 1. Live REST API & AWS Cloud Integration
- **Centralized API Client Architecture (`api-client.js`)**:
  - Reusable, modular service layers: `apiClient`, `authService`, `taskService`, `goalService`, `employeeService`, `analyticsService`, `notificationService`, and `healthService`.
  - Non-blocking asynchronous requests with configurable timeouts (`AbortController`).
  - Intelligent route normalization avoiding duplicate path prefixes (e.g. preventing `/tasks/tasks`).
  - Deep error normalization distinguishing between **400 Bad Request**, **401 Unauthorized**, **403 Forbidden**, **404 Not Found**, **429 Throttled**, **500 Lambda Failure**, **Network Offline**, and **CORS Blocks**.

### 2. Dedicated Settings → API Configuration Screen
- **Configurable Backend API URL**: Enter any AWS API Gateway stage endpoint (e.g. `https://<api-id>.execute-api.<region>.amazonaws.com/prod`) or local development endpoint.
- **Multi-Mode Authentication**:
  - **No Authentication**: Public APIs or local mock servers.
  - **Bearer Token**: Standard JWT / OAuth2 authorization headers.
  - **Amazon Cognito**: User Pool ID and public Client ID with ID/Access Token header injection.
  - **Public API Key Header**: `x-api-key` header for AWS Gateway Usage Plans.
- **Deep Connection Diagnostics**:
  - "Test Connection" button executes non-destructive health probes against `/health`, `/ping`, or `/tasks`.
  - Measures real round-trip latency in milliseconds.
  - Provides pinpoint diagnosis and specific AWS Lambda / API Gateway resolution steps if the connection fails.
- **Endpoint Diagnostics Matrix**:
  - Interactive "Probe All" feature tests `/health`, `/tasks`, `/goals`, `/employees`, `/analytics`, and `/notifications` with live status pills.
- **AWS API Gateway CORS Cheatsheet**:
  - Embedded developer reference with required response headers for serverless backends.

### 3. Clear Isolation: Demo Mode vs. Live Mode
- **Demo Mode**:
  - Uses rich in-memory sample enterprise datasets for local presentations, academic demonstrations, and visual prototyping.
  - Displays a persistent amber mode banner with quick actions to configure and switch.
- **Live Mode**:
  - Connects to the configured REST backend and displays genuine production data.
  - Displays live latency telemetry (e.g. `18ms`).
  - Never fabricates numbers or silently falls back to mock data if a live query fails; displays honest error and retry states.

### 4. Interactive Enterprise Page Views
- **Executive Dashboard**:
  - High-efficiency metrics ribbon: Total Tasks, Completed, Pending, Overdue, Active Goals, and Completion Rate.
  - Interactive **Chart.js** visualizations:
    - *Task Status Distribution* (Doughnut Chart)
    - *Strategic Goal OKR Delivery* (Horizontal Bar Chart)
  - 3-Tier sub-dashboards (Head Cascade Tree, Team Manager Governance Matrix, and Employee Cockpit).
- **Dedicated Tasks Management Pipeline (`#view-tasks`)**:
  - Full-featured data table with search, status filter chips (`All`, `In Progress`, `Ready for Review`, `Completed`, `Overdue`), assignee filter, and pagination.
  - Interactive progress slider on rows.
  - **Create / Edit Task Modal (`#modalCreateTask`)** for creating or updating tasks.
- **Strategic Goals & OKRs (`#view-goals`)**:
  - Detailed cards with delivery progress bars, OKR strategic weight badges, SLA deadlines, and linked subtask counts.
- **Workforce Directory (`#view-employees`)**:
  - Complete personnel cards with productivity indices, sprint focus hours, live status tags, and "View Employee Dossier" modal.
- **Enterprise Reports & Analytics (`#view-reports`)**:
  - Team productivity velocity curve line chart (`#chartVelocityTrend`).
  - Cloud SLA compliance rates across pods.
  - JSON metrics export and printable Executive Audit PDF.
- **Notification Center (`#view-notifications`)**:
  - Live alerts feed with read/unread tracking and category badges.

### 5. UI/UX Pro Max Polish & Dark Theme
- **Plus Jakarta Sans** typography paired with **JetBrains Mono** for engineering metrics.
- Complete **Dark Mode** system with smooth CSS variable transitions (`[data-theme="dark"]`).
- Dynamic Chart.js theme re-rendering adapting chart text and gridlines to light or dark mode.
- Accessible focus indicators (`:focus-visible`), WCAG AA/AAA compliant color contrast.
- Command Palette (**Ctrl + K** or **Cmd + K**) for instant keyboard navigation.

---

## 💻 Local Setup & Run

The application is built with lightweight, zero-build-tool HTML5, Vanilla JavaScript (ES6+), and modular CSS.

### Method 1: Python HTTP Server (Recommended)
```bash
# From the project root:
python -m http.server 8000
```
Open your browser at `http://localhost:8000`.

### Method 2: Node.js / NPM
```bash
# Run unit & integration test suite
npm test

# Or start with python script via npm
npm start
```

---

## 🌐 Live API Backend Integration Guide

### 1. Supported REST Endpoints Contract

| Endpoint | Method | Description | Auth Required | Request Body |
| :--- | :--- | :--- | :--- | :--- |
| `/health` | `GET` | Safe health probe | Optional | None |
| `/tasks` | `GET` | Fetch tasks list (supports `?status=&assignee=`) | Yes (if configured) | None |
| `/tasks` | `POST` | Create a new task | Yes | `{ title, parentDirective, assignedEmployee, assignedManager, dueDate, estHours, status, progress }` |
| `/tasks/:id` | `GET` | Get single task details | Yes | None |
| `/tasks/:id` | `PUT` | Update full task object | Yes | Updated task JSON |
| `/tasks/:id` | `PATCH` | Update task progress or status | Yes | `{ status, progress }` |
| `/tasks/:id` | `DELETE` | Delete or archive a task | Yes | None |
| `/goals` | `GET` | Fetch strategic directives (OKRs) | Yes | None |
| `/goals` | `POST` | Issue strategic directive from Head | Yes | `{ title, assignedManager, dept, priority, deadline, weight, directiveNotes }` |
| `/employees` | `GET` | Fetch organization workforce list | Yes | None |
| `/analytics` | `GET` | Fetch global telemetry & completion stats | Yes | None |
| `/notifications` | `GET` | Fetch notification feed items | Yes | None |
| `/notifications/:id/read` | `PATCH` | Mark alert as read | Yes | None |

*Note: If `/analytics` is unavailable on your backend, CloudPulse automatically computes authentic metrics from the fetched tasks and goals datasets.*

### 2. AWS API Gateway & Lambda CORS Configuration

To allow browser requests without CORS violations, your AWS Lambda functions or API Gateway Gateway Responses must include the following headers:

```json
{
  "statusCode": 200,
  "headers": {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,x-api-key,X-Cognito-Client-Id",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS"
  },
  "body": "..."
}
```

#### Preflight OPTIONS Route
Create an `OPTIONS` mock integration on all API Gateway resources:
1. Integration type: **Mock**
2. Method Response 200: Add `Access-Control-Allow-Origin`, `Access-Control-Allow-Headers`, `Access-Control-Allow-Methods`.
3. Integration Response 200: Map headers to `'*'` and permitted methods.

### 3. Amazon Cognito Authentication Setup
- Create an **Amazon Cognito User Pool**.
- Create an **App Client** without a client secret (browser Single Page Apps must use public client IDs).
- Configure authentication mode in **Settings → API Configuration**:
  - Enter your Cognito User Pool ID (e.g. `us-east-1_abcdef123`).
  - Enter your Cognito App Client ID (e.g. `7abcdef1234567890`).
  - Provide a valid ID Token or Access Token obtained from Cognito Hosted UI / SDK.
  - The client will inject `Authorization: Bearer <token>` on all requests.

---

## 🔒 Security & Safe Persistence Policy

- **No Secrets in Frontend Bundles**: Confidential AWS IAM credentials (`AWS_SECRET_ACCESS_KEY`), Cognito client secrets, or private database passwords are never stored in client code.
- **Safe Credential Handling**: Long-lived bearer tokens and sensitive API keys are kept in memory only and not permanently exposed in `localStorage`.
- **HTTPS Enforcement**: When a production non-localhost endpoint is entered, CloudPulse validates the `https://` protocol and warns the user if insecure plaintext `http://` is detected.
- **Clear Settings**: A one-click "Clear Saved Data" button in API Configuration purges any locally cached configuration.

---

## 🧪 Testing & Verification Status

| Component | Status | Details |
| :--- | :--- | :--- |
| **API Client (`api-client.js`)** | Verified (100% Pass) | 29 automated tests passing: URL normalization, error mapping, timeout abort, auth header injection |
| **Executive Dashboard & Charts** | Verified | Chart.js doughnut & bar charts initialized with dark/light theming |
| **Tasks Management** | Verified | Table, search filter, status filter, and Create Task modal tested |
| **Goals & OKRs Management** | Verified | Directive cascade cards, progress bars, and modal wiring tested |
| **Workforce Directory** | Verified | Employee roster, search, and scorecard modal dossiers tested |
| **Settings & Diagnostics** | Verified | Connection testing, health probes, presets, and matrix diagnostic tested |
| **Theme Engine** | Verified | Dark & Light theme switching with CSS tokens tested |
| **Live Backend Integration** | Awaiting Endpoint | Ready to connect as soon as the user supplies their live AWS API Gateway URL in Settings |

---

## 📁 Repository Structure

```
S5-MINI/
├── index.html              # Main single-page application entry point
├── styles.css              # Bespoke enterprise CSS design system & Dark Theme tokens
├── app.js                  # Main UI controller, routing, Chart.js lifecycle, and state
├── api-client.js           # Reusable REST API client, auth service, and health diagnostics
├── config.example.js       # Runtime configuration template
├── .env.example            # Environment variables example
├── package.json            # Node.js project scripts and metadata
├── tests/
│   └── integration-test.js # Automated unit & integration test suite (29 tests)
├── assets/
│   └── images/             # User persona avatars
└── README.md               # Complete documentation & integration guide
```

---

## 🛡️ License
Released under the MIT License. Built for enterprise cloud productivity and goal management demonstrations.
