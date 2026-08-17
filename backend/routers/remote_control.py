from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict

router = APIRouter(
    prefix="/ws",
    tags=["Remote Control WebSockets"]
)

class ConnectionManager:
    def __init__(self):
        # { "HOSTNAME": websocket }
        self.active_agents: Dict[str, WebSocket] = {}
        self.active_operators: Dict[str, WebSocket] = {}

    async def connect_agent(self, hostname: str, websocket: WebSocket):
        await websocket.accept()
        self.active_agents[hostname] = websocket
        print(f"🟢 [WS Agente] Conectado: {hostname}")

    async def connect_operator(self, hostname: str, websocket: WebSocket):
        await websocket.accept()
        self.active_operators[hostname] = websocket
        print(f"🔵 [WS Operador] Viendo a: {hostname}")

    def disconnect_agent(self, hostname: str):
        if hostname in self.active_agents:
            del self.active_agents[hostname]
            print(f"🔴 [WS Agente] Desconectado: {hostname}")

    def disconnect_operator(self, hostname: str):
        if hostname in self.active_operators:
            del self.active_operators[hostname]
            print(f"🔴 [WS Operador] Desconectado de: {hostname}")

    async def send_to_operator(self, hostname: str, message: str):
        if hostname in self.active_operators:
            await self.active_operators[hostname].send_text(message)

    async def send_to_agent(self, hostname: str, message: str):
        if hostname in self.active_agents:
            await self.active_agents[hostname].send_text(message)

manager = ConnectionManager()

# Endpoint para la PC remota que transmite su pantalla
@router.websocket("/agent/{hostname}")
async def websocket_agent(websocket: WebSocket, hostname: str):
    await manager.connect_agent(hostname, websocket)
    try:
        while True:
            # Recibe el fotograma en Base64 o comandos de la PC
            data = await websocket.receive_text()
            # Retransmite el fotograma en tiempo real a React
            await manager.send_to_operator(hostname, data)
    except WebSocketDisconnect:
        manager.disconnect_agent(hostname)

# Endpoint para la consola React (Operador)
@router.websocket("/operator/{hostname}")
async def websocket_operator(websocket: WebSocket, hostname: str):
    await manager.connect_operator(hostname, websocket)
    try:
        while True:
            # Recibe eventos de clic/teclado desde la interfaz web
            command = await websocket.receive_text()
            # Retransmite las acciones a la PC cliente
            await manager.send_to_agent(hostname, command)
    except WebSocketDisconnect:
        manager.disconnect_operator(hostname)