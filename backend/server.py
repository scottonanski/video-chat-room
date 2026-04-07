from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from typing import Dict, List, Optional
from datetime import datetime, timezone
import json
import os
import uuid
import asyncio

app = FastAPI(title="Team Call Platform API")

# CORS
cors_origins = os.getenv("CORS_ORIGINS", "*")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins.split(",") if cors_origins != "*" else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB (optional — set MONGO_ENABLED=true to persist chat messages)
MONGO_ENABLED = os.getenv("MONGO_ENABLED", "false").lower() in ("true", "1", "yes")

if MONGO_ENABLED:
    MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
    DB_NAME = os.getenv("DB_NAME", "team_call_db")
    client = AsyncIOMotorClient(MONGO_URL, serverSelectionTimeoutMS=3000)
    db = client[DB_NAME]
    messages_collection = db["messages"]
else:
    messages_collection = None
    print("ℹ MongoDB disabled — chat uses in-memory history (lost on server restart)")

# In-memory fallback for chat history when MongoDB is not available
_in_memory_messages: list[dict] = []
MAX_IN_MEMORY_MESSAGES = 200

class Message(BaseModel):
    message: str
    sender_name: str
    sender_id: str
    timestamp: Optional[datetime] = None


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, dict] = {}
        self.room_admin_id: Optional[str] = None
    
    async def connect(self, websocket: WebSocket, peer_id: str, name: str):
        await websocket.accept()
        
        # Handle reconnecting peer — close stale WebSocket if it exists
        if peer_id in self.active_connections:
            old_ws = self.active_connections[peer_id]["ws"]
            try:
                await old_ws.close()
            except Exception:
                pass
        
        # First person becomes admin if no admin exists
        if not self.room_admin_id:
            self.room_admin_id = peer_id
        
        self.active_connections[peer_id] = {
            "ws": websocket,
            "name": name,
            "isAdmin": peer_id == self.room_admin_id
        }
        
        # Send current peer list to new joiner
        peer_list = []
        for pid, data in self.active_connections.items():
            if pid != peer_id:
                peer_list.append({
                    "peerId": pid,
                    "name": data["name"],
                    "isAdmin": data["isAdmin"]
                })
        
        await websocket.send_json({
            "type": "peer-list",
            "peers": peer_list,
            "yourPeerId": peer_id,
            "yourName": name,
            "adminId": self.room_admin_id,
            "isAdmin": peer_id == self.room_admin_id
        })
        
        # Notify existing peers about new joiner
        await self.broadcast({
            "type": "peer-joined",
            "peerId": peer_id,
            "name": name,
            "isAdmin": peer_id == self.room_admin_id
        }, exclude_peer=peer_id)
        
        print(f"✓ {name} ({peer_id}) joined. Admin: {peer_id == self.room_admin_id}. Total: {len(self.active_connections)}")
    
    def disconnect(self, peer_id: str):
        if peer_id in self.active_connections:
            was_admin = peer_id == self.room_admin_id
            name = self.active_connections[peer_id]["name"]
            del self.active_connections[peer_id]
            print(f"✓ {name} ({peer_id}) left. Remaining: {len(self.active_connections)}")
            
            # Reassign admin if the current admin leaves and people remain in the room
            if was_admin and self.active_connections:
                self.room_admin_id = next(iter(self.active_connections))

                for pid, data in self.active_connections.items():
                    data["isAdmin"] = pid == self.room_admin_id

                return {
                    "type": "admin-changed",
                    "adminId": self.room_admin_id,
                    "adminName": self.active_connections[self.room_admin_id]["name"],
                }

            # Reset admin if the room is empty
            if not self.active_connections:
                self.room_admin_id = None

        return None
    
    async def send_to_peer(self, peer_id: str, message: dict):
        if peer_id in self.active_connections:
            try:
                await self.active_connections[peer_id]["ws"].send_json(message)
            except Exception as e:
                print(f"✗ Error sending to {peer_id}: {e}")
    
    async def broadcast(self, message: dict, exclude_peer: Optional[str] = None):
        for peer_id, data in list(self.active_connections.items()):
            if peer_id != exclude_peer:
                try:
                    await data["ws"].send_json(message)
                except Exception as e:
                    print(f"✗ Error broadcasting to {peer_id}: {e}")


manager = ConnectionManager()


@app.get("/")
async def root():
    return {"message": "Team Call Platform API", "status": "running"}


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "active_connections": len(manager.active_connections),
        "admin_id": manager.room_admin_id
    }


@app.get("/api/messages")
async def get_messages(limit: int = 100):
    """Get recent chat messages"""
    if not MONGO_ENABLED:
        return {"messages": _in_memory_messages[-limit:]}
    try:
        messages = await messages_collection.find(
            {},
            {"_id": 1, "message": 1, "sender_name": 1, "sender_id": 1, "timestamp": 1}
        ).sort("timestamp", -1).limit(limit).to_list(length=limit)
        messages.reverse()
        for msg in messages:
            msg["_id"] = str(msg["_id"])
            if msg.get("timestamp"):
                msg["timestamp"] = msg["timestamp"].isoformat()
        return {"messages": messages}
    except Exception as e:
        print(f"Error fetching messages: {e}")
        return {"messages": []}


@app.post("/api/messages")
async def save_message(message: Message):
    """Save a chat message"""
    if not MONGO_ENABLED:
        return {"success": False, "detail": "Persistence disabled"}
    try:
        msg_dict = message.dict()
        if not msg_dict.get("timestamp"):
            msg_dict["timestamp"] = datetime.now(timezone.utc)
        result = await messages_collection.insert_one(msg_dict)
        msg_dict["_id"] = str(result.inserted_id)
        msg_dict["timestamp"] = msg_dict["timestamp"].isoformat()
        return {"success": True, "message": msg_dict}
    except Exception as e:
        print(f"Error saving message: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.websocket("/ws/{peer_id}")
async def websocket_endpoint(websocket: WebSocket, peer_id: str):
    # Get name from query params
    name = websocket.query_params.get("name", f"User_{peer_id[:6]}")
    
    await manager.connect(websocket, peer_id, name)
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            msg_type = message.get("type")
            
            if msg_type == "offer":
                # Relay WebRTC offer
                target_peer = message.get("targetPeerId")
                await manager.send_to_peer(target_peer, {
                    "type": "offer",
                    "fromPeerId": peer_id,
                    "fromName": manager.active_connections[peer_id]["name"],
                    "offer": message.get("offer")
                })
            
            elif msg_type == "answer":
                # Relay WebRTC answer
                target_peer = message.get("targetPeerId")
                await manager.send_to_peer(target_peer, {
                    "type": "answer",
                    "fromPeerId": peer_id,
                    "answer": message.get("answer")
                })
            
            elif msg_type == "ice-candidate":
                # Relay ICE candidate
                target_peer = message.get("targetPeerId")
                await manager.send_to_peer(target_peer, {
                    "type": "ice-candidate",
                    "fromPeerId": peer_id,
                    "candidate": message.get("candidate")
                })
            
            elif msg_type == "chat":
                # Broadcast chat message immediately for real-time experience
                chat_msg = message.get("message", "")
                sender_name = manager.active_connections[peer_id]["name"]
                
                await manager.broadcast({
                    "type": "chat",
                    "message": chat_msg,
                    "senderName": sender_name,
                    "senderId": peer_id,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })
                
                # Persist message
                msg_doc = {
                    "message": chat_msg,
                    "sender_name": sender_name,
                    "sender_id": peer_id,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
                if not MONGO_ENABLED:
                    _in_memory_messages.append(msg_doc)
                    if len(_in_memory_messages) > MAX_IN_MEMORY_MESSAGES:
                        del _in_memory_messages[:len(_in_memory_messages) - MAX_IN_MEMORY_MESSAGES]
                if MONGO_ENABLED:
                    async def _persist_msg():
                        try:
                            msg_doc = {
                                "message": chat_msg,
                                "sender_name": sender_name,
                                "sender_id": peer_id,
                                "timestamp": datetime.now(timezone.utc)
                            }
                            await messages_collection.insert_one(msg_doc)
                        except (Exception, asyncio.CancelledError) as e:
                            print(f"⚠ Chat not persisted (DB unavailable): {e}")
                    asyncio.create_task(_persist_msg())
            
            elif msg_type == "kick":
                # Admin action: kick a peer
                if manager.active_connections[peer_id]["isAdmin"]:
                    target_peer = message.get("targetPeerId")
                    await manager.send_to_peer(target_peer, {
                        "type": "kicked",
                        "reason": "Removed by admin"
                    })
                    print(f"Admin {peer_id} kicked {target_peer}")
            
            elif msg_type == "mute":
                # Admin action: request peer to mute
                if manager.active_connections[peer_id]["isAdmin"]:
                    target_peer = message.get("targetPeerId")
                    await manager.send_to_peer(target_peer, {
                        "type": "mute-request",
                        "reason": "Muted by admin"
                    })
            
            elif msg_type == "status":
                # Broadcast status (hand, brb, null) to all peers
                await manager.broadcast({
                    "type": "status",
                    "peerId": peer_id,
                    "status": message.get("status")
                })
            
            elif msg_type == "camera-off":
                # Admin action: request peer to turn off camera
                if manager.active_connections[peer_id]["isAdmin"]:
                    target_peer = message.get("targetPeerId")
                    await manager.send_to_peer(target_peer, {
                        "type": "camera-off-request",
                        "reason": "Camera disabled by admin"
                    })
    
    except WebSocketDisconnect:
        admin_change_message = manager.disconnect(peer_id)
        if admin_change_message:
            await manager.broadcast(admin_change_message)
        await manager.broadcast({
            "type": "peer-left",
            "peerId": peer_id
        })
    except (Exception, asyncio.CancelledError) as e:
        print(f"WebSocket error for {peer_id}: {e}")
        admin_change_message = manager.disconnect(peer_id)
        if admin_change_message:
            await manager.broadcast(admin_change_message)
        await manager.broadcast({
            "type": "peer-left",
            "peerId": peer_id
        })


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8001"))
    uvicorn.run(app, host="0.0.0.0", port=port)
