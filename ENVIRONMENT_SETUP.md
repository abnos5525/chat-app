# Environment Configuration Setup

This project uses a shared `.env` file in the root directory for both frontend and backend configuration.

## Create the .env file

Create a `.env` file in the root directory (`/chat-app/.env`) with the following content:

```env
# Server Configuration
SERVER_PORT=3001
FRONTEND_PORT=3000

# URLs (using SERVER_PORT variable)
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:${SERVER_PORT}

# WebSocket Configuration
WEBSOCKET_TRANSPORTS=websocket
WEBSOCKET_RECONNECTION=true
WEBSOCKET_RECONNECTION_ATTEMPTS=5
WEBSOCKET_RECONNECTION_DELAY=1000
```

## Alternative: Direct Port Reference

You can also use the port directly in the BACKEND_URL:

```env
# Server Configuration
SERVER_PORT=3001
FRONTEND_PORT=3000

# URLs
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:3001

# WebSocket Configuration
WEBSOCKET_TRANSPORTS=websocket
WEBSOCKET_RECONNECTION=true
WEBSOCKET_RECONNECTION_ATTEMPTS=5
WEBSOCKET_RECONNECTION_DELAY=1000
```

## How it works

### Backend (NestJS)
- Uses `process.env.SERVER_PORT` to read the port
- Automatically loads `.env` file from root directory
- Falls back to default values if environment variables are not set

### Frontend (Vite + React)
- Uses `import.meta.env.VITE_BACKEND_URL` to read the backend URL
- Vite automatically loads `.env` file from root directory
- All environment variables must be prefixed with `VITE_` to be accessible

## Current Configuration

- **Backend**: Runs on port 3001 (from SERVER_PORT)
- **Frontend**: Runs on port 3000 (from FRONTEND_PORT)
- **WebSocket**: Backend accepts connections from frontend URL
- **CORS**: Backend allows requests from frontend URL

## To change ports

1. Update the `SERVER_PORT` in the `.env` file
2. The `BACKEND_URL` will automatically use the new port
3. Restart both frontend and backend services
4. The services will automatically use the new configuration

## Benefits of Variable Substitution

- ✅ **Consistency**: BACKEND_URL automatically matches SERVER_PORT
- ✅ **Single Point of Change**: Update SERVER_PORT, everything updates
- ✅ **Reduced Errors**: No risk of mismatched port numbers
- ✅ **Easier Maintenance**: One variable controls the backend port

## Example .env file with Variable Substitution

```env
# Change SERVER_PORT and everything updates automatically
SERVER_PORT=3001
FRONTEND_PORT=3000
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:${SERVER_PORT}
``` 