import { NextRequest } from 'next/server';
import EventEmitter from 'events';

const globalRef = global as unknown as {
  cameraFeeds?: {
    [key: string]: {
      image: string;
      timestamp: number;
    }
  };
  cameraEmitter?: EventEmitter;
};

if (!globalRef.cameraEmitter) {
  globalRef.cameraEmitter = new EventEmitter();
  globalRef.cameraEmitter.setMaxListeners(50);
}

const cameraEmitter = globalRef.cameraEmitter;

function dataUrlToBuffer(dataUrl: string) {
  const matches = dataUrl.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    return null;
  }
  return Buffer.from(matches[2], 'base64');
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id || (id !== '1' && id !== '2')) {
    return new Response('ID de câmera inválido.', { status: 400 });
  }

  const boundary = 'mjpegframe';
  const headers = new Headers({
    'Content-Type': `multipart/x-mixed-replace; boundary=${boundary}`,
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache, no-transform, private, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  });

  const stream = new ReadableStream({
    start(controller) {
      const sendFrame = (imgDataUrl: string) => {
        const buffer = dataUrlToBuffer(imgDataUrl);
        if (!buffer) return;

        const header = `--${boundary}\r\nContent-Type: image/jpeg\r\nContent-Length: ${buffer.length}\r\n\r\n`;
        const footer = '\r\n';

        try {
          controller.enqueue(Buffer.concat([
            Buffer.from(header),
            buffer,
            Buffer.from(footer)
          ]));
        } catch (e) {
          cleanup();
        }
      };

      // Send the last cached frame immediately if available
      const lastFeed = globalRef.cameraFeeds?.[id];
      if (lastFeed && lastFeed.image) {
        sendFrame(lastFeed.image);
      }

      const onFrameEmit = (emitterId: string, image: string) => {
        if (emitterId === id) {
          sendFrame(image);
        }
      };

      cameraEmitter.on('frame', onFrameEmit);

      const cleanup = () => {
        cameraEmitter.off('frame', onFrameEmit);
        try {
          controller.close();
        } catch (e) {}
      };

      request.signal.addEventListener('abort', cleanup);
    },
    cancel() {
      // Handled in abort/cleanup
    }
  });

  return new Response(stream, { headers });
}

export const dynamic = 'force-dynamic';
