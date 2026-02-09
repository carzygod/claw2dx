# WebSocket Server Requirements

## 1. Overview
The goal is to create a WebSocket Relay Server that allows multiple clients (Live2D Extensions) to connect and control each other's models. 
The server acts as a message broker, enabling **Anyone-to-Anyone** and **Broadcast** communication.

## 2. Server Specification

*   **Protocol**: WebSocket (ws:// or wss://)
*   **Port**: Configurable (Default: 8080)
*   **Role**: Relay Server (Stateless message passing)

## 3. Connection Handling

### 3.1. On Connect
1.  Accept the WebSocket connection.
2.  Assign a unique **User ID** (UUID v4) to the client.
3.  Send a `WELCOME` message to the client containing their assigned ID.

### 3.2. On Disconnect
1.  Remove the client from the active list.
2.  (Optional) Broadcast a `USER_LEFT` message to other clients.

## 4. Message Protocol
The server must handle JSON messages. The structure wraps the Live2D payload defined in `ws.example.json`.

### 4.1. Server-Bound Messages (Client -> Server)
Clients send messages to the server to control other clients.

**Format**:
```json
{
  "type": "BROADCAST" | "DIRECT",
  "targetId": "uuid-string (Required if type is DIRECT)",
  "payload": { ... } // Content from ws.example.json
}
```

*   **`type`**:
    *   `BROADCAST`: Send to all connected clients (excluding sender).
    *   `DIRECT`: Send to a specific client identified by `targetId`.
*   **`payload`**: The actual command data (Model, Motion, Expression, Message) as defined in `ws.example.json`.
    *   **Validation**: The server should verify `payload` takes the form of a JSON object but does not need to validate specific model fields against `models.json` (clients handle that).

### 4.2. Client-Bound Messages (Server -> Client)
The server forwards messages to the target client(s).

**Format**:
```json
{
  "senderId": "uuid-string (ID of the original sender)",
  "type": "COMMAND",
  "data": { ... } // The payload from the sender
}
```

*   **`senderId`**: ID of the user who sent the command.
*   **`data`**: The exact payload received from the sender.

## 5. Integration with Models
The server relies on the clients to enforce the capabilities described in `models.json`.
*   **`models.json`**: Defines available models, expressions (tags), and motions (tags).
*   **Server Role**: The server is agnostic to the model content. It purely relays the `tag_n` keys or model names.

## 6. Example Flow

1.  **Client A** connects. Server assigns ID: `User-A`.
2.  **Client B** connects. Server assigns ID: `User-B`.
3.  **Client A** wants to verify connection:
    *   Sends: `{"type": "BROADCAST", "payload": {"message": "Hello World"}}`
4.  **Server** receives and forwards to **Client B**:
    *   Sends to B: `{"senderId": "User-A", "type": "COMMAND", "data": {"message": "Hello World"}}`
5.  **Client B** (Live2D Extension) receives message:
    *   Internal Logic: Displays speech bubble "Hello World".

## 7. Future Considerations
*   **Rooms**: Implement room logic to group users (e.g., `JOIN_ROOM`, `LEAVE_ROOM`).
*   **Auth**: Simple token-based authentication if needed.
