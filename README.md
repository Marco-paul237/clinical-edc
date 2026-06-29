# Secure Clinical Trial EDC Portal

A secure, containerized Clinical Trial Electronic Data Capture (EDC) portal utilizing **Next.js** (App Router), **Node.js/Express** (TypeScript), **PostgreSQL**, and **Keycloak OIDC Identity Management**.

---

## Prerequisites

Before running the application, make sure you have the following installed:
*   [Node.js](https://nodejs.org/) (v18 or higher)
*   [Docker Desktop](https://www.docker.com/products/docker-desktop/) (must be running)
*   [ngrok CLI](https://ngrok.com/) (optional, required only for remote public exposure)

---

## 🛠 Getting Started Guide

Follow these steps to run the complete project locally:

### Step 1: Clone the Repository & Install Dependencies
First, install the local packages for both the backend and frontend components.

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### Step 2: Spin Up the Infrastructure Containers
Run Docker Compose in the project root to launch the PostgreSQL database and Keycloak IAM services:

```bash
cd ..
docker compose up -d db keycloak
```
*Note: Keycloak is exposed on port `8081` and PostgreSQL on port `5433` (mapping internally to default container ports to prevent conflicts with local services).*

### Step 3: Configure Environment Variables
You must create environment configuration files (`.env`) in both the `backend/` and `frontend/` folders.

#### 1. Backend Config File
Create a new file named `backend/.env` with the following variables:
```env
PORT=5002
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/edc
KEYCLOAK_URL=http://localhost:8081
KEYCLOAK_REALM=edc-realm
KEYCLOAK_CLIENT_ID=edc-backend
USE_MOCK_IAM=false
```

#### 2. Frontend Config File
Create a new file named `frontend/.env` with the following variables:
```env
PORT=3000
NEXT_PUBLIC_BACKEND_URL=
NEXT_PUBLIC_KEYCLOAK_URL=http://localhost:8081
NEXT_PUBLIC_KEYCLOAK_REALM=edc-realm
NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=edc-frontend
NEXT_PUBLIC_USE_MOCK_IAM=false
```

### Step 4: Run the Services

#### 1. Start the Backend Server
```bash
cd backend
npm run dev
```
*(The backend features a connection retry handler that automatically polls the PostgreSQL container on port `5433` for up to 10 attempts at 2-second intervals, making it resilient to container startup delays).*

#### 2. Start the Frontend Server
```bash
cd ../frontend
npm run dev
```

The application is now running and accessible at:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## 🔐 Authentication Guides (SSO vs. Credentials)

### 1. Portal Credentials Login (Backdoor)
Because mock developer accounts have been removed to enforce production credentials compliance, the database initializes as completely blank.

1. Navigate to: **`http://localhost:3000/login?backdoor=true`**
2. The form will automatically switch to **Sign Up** mode.
3. Register a username, email, and password.
4. Once registered, your user is saved to the PostgreSQL database and you are signed in.
5. For subsequent visits, you can log in directly from the **Portal Account** tab using `http://localhost:3000/login`.

---

### 2. Enterprise SSO Login (Keycloak)
Keycloak imports the `edc-realm` configuration automatically on container startup using [keycloak-realm.json](file:///Users/ndepemarco/Desktop/brice/keycloak-realm.json). However, there are no default users.

To add a user:
1. Open the Keycloak Admin Console: **[http://localhost:8081](http://localhost:8081)**
2. Sign in using the Admin credentials:
   *   **Username**: `admin`
   *   **Password**: `admin`
3. In the top-left dropdown, select the **`edc-realm`**.
4. Navigate to **Users** in the left sidebar and click **Add user**.
5. Fill out the username (e.g. `doctor_bob`), email, and first/last name.
6. Once created, click the **Credentials** tab on the user detail page, select **Set password**, enter a password, and toggle **Temporary** to `Off`.
7. Go back to your frontend tab, select the **Enterprise SSO** tab, and click OIDC Sign In.

---

## 🌐 Public Tunnel (Remote Exposure)

To expose the application publicly (e.g. for testing on mobile devices or letting external users access it):

1. Set your `NGROK_AUTHTOKEN` inside the root `.env` file.
2. Run the tunnel orchestration script:
   ```bash
   node start-tunnels.js
   ```
3. Open the public ngrok address printed in the terminal (e.g. `https://your-tunnel.ngrok-free.dev`).

> [!WARNING]
> **SSO Local Host Redirection limitation**: Since Keycloak is bound locally to port `8081` on your host machine, clicking OIDC Login over an ngrok connection will try to redirect to `localhost:8081` (which refers to the client's device, not the host). For remote testing, use the **Portal Credentials Login** tab, which uses relative routing and works seamlessly across tunnels.

---

## 🔍 Troubleshooting Errors

### `Error: listen EADDRINUSE: address already in use :::5002`
This error means a previous backend server process is still running and occupying port 5002.
*   **On macOS**, kill it with this terminal shortcut:
    ```bash
    kill -9 $(lsof -t -i:5002)
    ```
*   **Or use npm script runner**:
    ```bash
    npx kill-port 5002
    ```
