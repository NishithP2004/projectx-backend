# projectx-backend

## Execution Steps

1. **Clone Backend Repository:** 
   - Clone the backend repository from GitHub using the following command:
     ```bash
     git clone https://github.com/NishithP2004/projectx-backend.git
     ```

2. **Navigate to Backend Directory:** 
   - Move into the `projectx-backend` directory:
     ```bash
     cd projectx-backend
     ```

3. **Create Environment Variables File:** 
   - Create a `.env` file in the root of the `projectx-backend` directory.
   - Copy the contents of the `.env.example` file provided below and paste it into the `.env` file.
   - Fill in the required values for your environment variables. Refer to the comments in the `.env.example` file for guidance on each variable.

4. **Install Dependencies:** 
   - Install the necessary dependencies by running:
     ```bash
     npm install
     ```

5. **Start Backend Service:** 
   - Ensure you have Microsoft Azure CLI tools installed.
   - Start the backend service using the Azure Functions Core Tools:
     ```bash
     func start
     ```

6. **Access Backend Endpoints:** 
   - Once the backend service is running, you can access the various API endpoints provided by the backend component.

---

## .env.example (Common to both frontend & backend)

```
G_SEARCH_KEY=
G_CX=
BING_CONFIG_ID=
BING_API_KEY=
GOOGLE_PALM_API_KEY=
GOOGLE_VERTEX_AI_TOKEN=
GOOGLE_VERTEX_AI_PROJECT_ID=
YT_API_KEY=
GOOGLE_APPLICATION_CREDENTIALS=
AZURE_STORAGE_CONNECTION_STRING=
AZURE_STORAGE_ACCOUNT_NAME=
AZURE_STORAGE_CONTAINER_NAME=
AZURE_FR_KEY=
AZURE_FR_ENDPOINT=
# MONGO_CONNECTION_URL=
MONGO_NAMESPACE=
PORT=
# BASE_URL=
BASE_URL="http://localhost:7071"
```

---
