"""
TCP stream proxy forwarding port 8000 to port 8088.
Enables seamless access to AIDA64 Dashboard on http://127.0.0.1:8000/ as well as http://127.0.0.1:8088/.
"""
import asyncio
import sys

async def pipe(reader, writer):
    try:
        while True:
            data = await reader.read(65536)
            if not data:
                break
            writer.write(data)
            await writer.drain()
    except Exception:
        pass
    finally:
        try:
            writer.close()
            await writer.wait_closed()
        except Exception:
            pass

async def handle_client(local_reader, local_writer):
    try:
        remote_reader, remote_writer = await asyncio.open_connection("127.0.0.1", 8088)
    except Exception as e:
        try:
            local_writer.close()
            await local_writer.wait_closed()
        except Exception:
            pass
        return

    await asyncio.gather(
        pipe(local_reader, remote_writer),
        pipe(remote_reader, local_writer),
        return_exceptions=True
    )

async def main():
    server = await asyncio.start_server(handle_client, "127.0.0.1", 8000)
    print("Port forwarder listening on 127.0.0.1:8000 -> 127.0.0.1:8088", flush=True)
    async with server:
        await server.serve_forever()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
