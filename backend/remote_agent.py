import asyncio
import base64
import io
import json
import socket
import websockets
import mss
from PIL import Image
from pynput.mouse import Controller as MouseController, Button
from pynput.keyboard import Controller as KeyboardController, Key

SERVER_IP = "172.21.20.14:8006"
HOSTNAME = socket.gethostname()
WS_URL = f"ws://{SERVER_IP}/api/ws/agent/{HOSTNAME}"

mouse = MouseController()
keyboard = KeyboardController()

# Mapeo de teclas especiales del navegador → pynput
SPECIAL_KEYS = {
    "Enter": Key.enter,
    "Backspace": Key.backspace,
    "Tab": Key.tab,
    "Escape": Key.esc,
    "ArrowUp": Key.up,
    "ArrowDown": Key.down,
    "ArrowLeft": Key.left,
    "ArrowRight": Key.right,
    "Delete": Key.delete,
    "Home": Key.home,
    "End": Key.end,
    "PageUp": Key.page_up,
    "PageDown": Key.page_down,
    "Control": Key.ctrl,
    "Shift": Key.shift,
    "Alt": Key.alt,
    "Meta": Key.cmd,
    " ": Key.space,
}

def handle_input(msg: dict, screen_w: int, screen_h: int):
    """Aplica eventos de ratón/teclado recibidos del operador."""
    try:
        t = msg.get("type")

        if t == "mouse":
            # x, y vienen normalizados 0.0–1.0 respecto al canvas
            x = int(float(msg.get("x", 0)) * screen_w)
            y = int(float(msg.get("y", 0)) * screen_h)
            action = msg.get("action")
            button = msg.get("button", 0)  # 0=izq, 1=medio, 2=der

            btn = Button.left
            if button == 2:
                btn = Button.right
            elif button == 1:
                btn = Button.middle

            if action == "move":
                mouse.position = (x, y)
            elif action == "down":
                mouse.position = (x, y)
                mouse.press(btn)
            elif action == "up":
                mouse.position = (x, y)
                mouse.release(btn)
            elif action == "click":
                mouse.position = (x, y)
                mouse.click(btn, 1)
            elif action == "dblclick":
                mouse.position = (x, y)
                mouse.click(btn, 2)
            elif action == "scroll":
                dy = int(msg.get("dy", 0))
                mouse.position = (x, y)
                mouse.scroll(0, dy)

        elif t == "key":
            action = msg.get("action")  # down / up
            key_name = msg.get("key", "")

            key = SPECIAL_KEYS.get(key_name)
            if key is None and len(key_name) == 1:
                key = key_name

            if key is None:
                return

            if action == "down":
                keyboard.press(key)
            elif action == "up":
                keyboard.release(key)

    except Exception as e:
        print(f"Error aplicando input: {e}")


async def stream_screen():
    print(f"Iniciando agente de streaming para: {HOSTNAME}")
    print(f"Conectando a -> {WS_URL}")

    while True:
        try:
            async with websockets.connect(WS_URL) as websocket:
                print("Conectado al servidor de control remoto.")

                with mss.MSS() as sct:
                    monitor = sct.monitors[1]
                    screen_w = monitor["width"]
                    screen_h = monitor["height"]

                    async def send_frames():
                        while True:
                            img = sct.grab(monitor)
                            img_pil = Image.frombytes("RGB", img.size, img.rgb)
                            img_pil.thumbnail((1280, 720))
                            buffered = io.BytesIO()
                            img_pil.save(buffered, format="JPEG", quality=55)
                            encoded = base64.b64encode(buffered.getvalue()).decode("utf-8")
                            await websocket.send(encoded)
                            await asyncio.sleep(0.12)  # ~8 FPS

                    async def receive_commands():
                        while True:
                            raw = await websocket.recv()
                            # Si llega un frame (string largo base64) lo ignoramos;
                            # los comandos son JSON cortos
                            if not raw or len(raw) > 500:
                                continue
                            try:
                                msg = json.loads(raw)
                                handle_input(msg, screen_w, screen_h)
                            except json.JSONDecodeError:
                                pass

                    # Enviar pantalla y recibir comandos a la vez
                    await asyncio.gather(send_frames(), receive_commands())

        except (websockets.ConnectionClosedError, ConnectionRefusedError) as e:
            print(f"Conexion perdida ({e}). Reintentando en 5s...")
            await asyncio.sleep(5)
        except Exception as e:
            print(f"Error: {e}")
            await asyncio.sleep(5)


if __name__ == "__main__":
    asyncio.run(stream_screen())