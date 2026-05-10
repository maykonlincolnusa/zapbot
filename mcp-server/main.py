import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx
from dotenv import load_dotenv
from mcp.server.fastmcp import FastMCP

load_dotenv()

mcp = FastMCP("zapbot-ai-whatsapp")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class MockBackend:
    def __init__(self) -> None:
        self.contacts: List[Dict[str, Any]] = [
            {
                "id": 1,
                "name": "Demo Lead",
                "phone": "5511999999999",
                "email": "lead@example.local",
                "tags": ["lead", "mcp"],
            }
        ]
        self.chats: List[Dict[str, Any]] = [
            {
                "id": 1,
                "status": "open",
                "ContactId": 1,
                "lastMessageAt": now_iso(),
                "Contact": self.contacts[0],
                "assignedAttendant": None,
            }
        ]
        self.messages: List[Dict[str, Any]] = [
            {
                "id": 1,
                "ChatId": 1,
                "ContactId": 1,
                "direction": "inbound",
                "body": "Ola, quero conhecer o ZapBot AI.",
                "status": "received",
                "createdAt": now_iso(),
            }
        ]

        data_path = os.getenv("MCP_MOCK_DATA_PATH")
        if data_path and Path(data_path).exists():
            payload = json.loads(Path(data_path).read_text(encoding="utf-8"))
            self.contacts = payload.get("contacts", self.contacts)
            self.chats = payload.get("chats", self.chats)
            self.messages = payload.get("messages", self.messages)

    def _contact_for_phone(self, phone: str) -> Dict[str, Any]:
        for contact in self.contacts:
            if contact.get("phone") == phone:
                return contact

        contact = {
            "id": len(self.contacts) + 1,
            "name": phone,
            "phone": phone,
            "email": None,
            "tags": ["mcp"],
        }
        self.contacts.append(contact)
        self.chats.append(
            {
                "id": len(self.chats) + 1,
                "status": "open",
                "ContactId": contact["id"],
                "lastMessageAt": now_iso(),
                "Contact": contact,
                "assignedAttendant": None,
            }
        )
        return contact

    def _chat_for_contact(self, contact_id: int) -> Dict[str, Any]:
        for chat in self.chats:
            if chat.get("ContactId") == contact_id and chat.get("status") == "open":
                return chat
        contact = next((item for item in self.contacts if item["id"] == contact_id), None)
        chat = {
            "id": len(self.chats) + 1,
            "status": "open",
            "ContactId": contact_id,
            "lastMessageAt": now_iso(),
            "Contact": contact,
            "assignedAttendant": None,
        }
        self.chats.append(chat)
        return chat

    async def search_contacts(self, query: str = "", limit: int = 25) -> List[Dict[str, Any]]:
        value = query.lower().strip()
        results = [
            contact
            for contact in self.contacts
            if not value
            or value in str(contact.get("name", "")).lower()
            or value in str(contact.get("phone", "")).lower()
            or value in str(contact.get("email", "")).lower()
        ]
        return results[:limit]

    async def create_contact(
        self,
        phone: str,
        name: Optional[str] = None,
        email: Optional[str] = None,
        tags: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        contact = self._contact_for_phone(phone)
        contact.update(
            {
                "name": name or contact.get("name") or phone,
                "email": email or contact.get("email"),
                "tags": tags or contact.get("tags") or ["mcp"],
            }
        )
        return contact

    async def list_chats(self, filter: str = "all", limit: int = 50) -> List[Dict[str, Any]]:
        results = self.chats
        if filter == "unassigned":
            results = [chat for chat in results if not chat.get("assignedAttendant")]
        return results[:limit]

    async def get_chat(self, chat_id: int) -> Dict[str, Any]:
        chat = next((item for item in self.chats if item["id"] == chat_id), None)
        if not chat:
            raise ValueError(f"Chat {chat_id} not found")
        return {
            **chat,
            "Messages": [message for message in self.messages if message.get("ChatId") == chat_id],
        }

    async def list_messages(self, chat_id: int, limit: int = 100) -> List[Dict[str, Any]]:
        return [message for message in self.messages if message.get("ChatId") == chat_id][-limit:]

    async def send_message(
        self,
        text: str,
        to: Optional[str] = None,
        contact_id: Optional[int] = None,
        chat_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        if chat_id:
            chat = await self.get_chat(chat_id)
            contact = next((item for item in self.contacts if item["id"] == chat["ContactId"]), None)
        elif contact_id:
            contact = next((item for item in self.contacts if item["id"] == contact_id), None)
            if not contact:
                raise ValueError(f"Contact {contact_id} not found")
            chat = self._chat_for_contact(contact["id"])
        elif to:
            contact = self._contact_for_phone(to)
            chat = self._chat_for_contact(contact["id"])
        else:
            raise ValueError("Provide to, contact_id, or chat_id")

        message = {
            "id": len(self.messages) + 1,
            "ChatId": chat["id"],
            "ContactId": contact["id"] if contact else None,
            "direction": "outbound",
            "body": text,
            "status": "mock_sent",
            "createdAt": now_iso(),
            "metadata": {"source": "mcp_mock"},
        }
        self.messages.append(message)
        chat["lastMessageAt"] = message["createdAt"]
        return message

    async def send_file(
        self,
        media_url: str,
        to: Optional[str] = None,
        contact_id: Optional[int] = None,
        chat_id: Optional[int] = None,
        media_type: str = "document",
        caption: Optional[str] = None,
        filename: Optional[str] = None,
    ) -> Dict[str, Any]:
        body = caption or filename or f"[{media_type}]"
        message = await self.send_message(body, to=to, contact_id=contact_id, chat_id=chat_id)
        message["metadata"] = {
            "source": "mcp_mock",
            "mediaUrl": media_url,
            "mediaType": media_type,
            "filename": filename,
        }
        return message


class ZapBotApiBackend:
    def __init__(self) -> None:
        self.base_url = os.getenv("ZAPBOT_API_BASE_URL", "http://localhost:3000").rstrip("/")
        self.token = os.getenv("ZAPBOT_API_TOKEN") or os.getenv("SERVICE_TOKEN") or os.getenv("API_INTEGRATION_KEY")
        if not self.token:
            raise RuntimeError("ZAPBOT_API_TOKEN, SERVICE_TOKEN, or API_INTEGRATION_KEY is required in live mode")

    async def _request(self, method: str, path: str, **kwargs: Any) -> Any:
        headers = kwargs.pop("headers", {})
        headers["Authorization"] = f"Bearer {self.token}"
        async with httpx.AsyncClient(timeout=float(os.getenv("ZAPBOT_API_TIMEOUT_SECONDS", "20"))) as client:
            response = await client.request(method, f"{self.base_url}{path}", headers=headers, **kwargs)
            response.raise_for_status()
            return response.json()

    async def search_contacts(self, query: str = "", limit: int = 25) -> List[Dict[str, Any]]:
        return await self._request("GET", "/api/mcp/contacts/search", params={"q": query, "limit": limit})

    async def create_contact(
        self,
        phone: str,
        name: Optional[str] = None,
        email: Optional[str] = None,
        tags: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        return await self._request(
            "POST",
            "/api/mcp/contacts",
            json={"phone": phone, "name": name, "email": email, "tags": tags or ["mcp"]},
        )

    async def list_chats(self, filter: str = "all", limit: int = 50) -> List[Dict[str, Any]]:
        return await self._request("GET", "/api/mcp/chats", params={"filter": filter, "limit": limit})

    async def get_chat(self, chat_id: int) -> Dict[str, Any]:
        return await self._request("GET", f"/api/mcp/chats/{chat_id}")

    async def list_messages(self, chat_id: int, limit: int = 100) -> List[Dict[str, Any]]:
        return await self._request("GET", f"/api/mcp/chats/{chat_id}/messages", params={"limit": limit})

    async def send_message(
        self,
        text: str,
        to: Optional[str] = None,
        contact_id: Optional[int] = None,
        chat_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        return await self._request(
            "POST",
            "/api/mcp/messages",
            json={"to": to, "contactId": contact_id, "chatId": chat_id, "body": text, "client": "mcp"},
        )

    async def send_file(
        self,
        media_url: str,
        to: Optional[str] = None,
        contact_id: Optional[int] = None,
        chat_id: Optional[int] = None,
        media_type: str = "document",
        caption: Optional[str] = None,
        filename: Optional[str] = None,
    ) -> Dict[str, Any]:
        return await self._request(
            "POST",
            "/api/mcp/files",
            json={
                "to": to,
                "contactId": contact_id,
                "chatId": chat_id,
                "mediaUrl": media_url,
                "mediaType": media_type,
                "caption": caption,
                "filename": filename,
                "client": "mcp",
            },
        )


def backend() -> Any:
    mode = os.getenv("MCP_BACKEND", "mock").lower()
    return ZapBotApiBackend() if mode == "live" else MockBackend()


BACKEND = backend()


@mcp.tool()
async def search_contacts(query: str = "", limit: int = 25) -> List[Dict[str, Any]]:
    """Search ZapBot contacts by name, phone or email."""
    return await BACKEND.search_contacts(query=query, limit=limit)


@mcp.tool()
async def create_contact(
    phone: str,
    name: Optional[str] = None,
    email: Optional[str] = None,
    tags: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Create or update a ZapBot contact."""
    return await BACKEND.create_contact(phone=phone, name=name, email=email, tags=tags)


@mcp.tool()
async def list_chats(filter: str = "all", limit: int = 50) -> List[Dict[str, Any]]:
    """List WhatsApp chats. Filter can be all, unassigned or mine."""
    return await BACKEND.list_chats(filter=filter, limit=limit)


@mcp.tool()
async def get_chat(chat_id: int) -> Dict[str, Any]:
    """Return one chat with recent history."""
    return await BACKEND.get_chat(chat_id)


@mcp.tool()
async def list_messages(chat_id: int, limit: int = 100) -> List[Dict[str, Any]]:
    """List messages for a chat in chronological order."""
    return await BACKEND.list_messages(chat_id=chat_id, limit=limit)


@mcp.tool()
async def send_whatsapp_message(
    text: str,
    to: Optional[str] = None,
    contact_id: Optional[int] = None,
    chat_id: Optional[int] = None,
) -> Dict[str, Any]:
    """Send a WhatsApp text message through ZapBot AI."""
    return await BACKEND.send_message(text=text, to=to, contact_id=contact_id, chat_id=chat_id)


@mcp.tool()
async def send_file(
    media_url: str,
    to: Optional[str] = None,
    contact_id: Optional[int] = None,
    chat_id: Optional[int] = None,
    media_type: str = "document",
    caption: Optional[str] = None,
    filename: Optional[str] = None,
) -> Dict[str, Any]:
    """Send a WhatsApp media URL through ZapBot AI. Use media_type document, image, audio or video."""
    return await BACKEND.send_file(
        media_url=media_url,
        to=to,
        contact_id=contact_id,
        chat_id=chat_id,
        media_type=media_type,
        caption=caption,
        filename=filename,
    )


if __name__ == "__main__":
    mcp.run(transport=os.getenv("MCP_TRANSPORT", "stdio"))
