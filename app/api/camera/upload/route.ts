import { NextRequest, NextResponse } from 'next/server';
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

if (!globalRef.cameraFeeds) {
  globalRef.cameraFeeds = {
    '1': { image: '', timestamp: 0 },
    '2': { image: '', timestamp: 0 }
  };
}

if (!globalRef.cameraEmitter) {
  globalRef.cameraEmitter = new EventEmitter();
  globalRef.cameraEmitter.setMaxListeners(50);
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id || (id !== '1' && id !== '2')) {
      return NextResponse.json({ error: 'ID de câmera inválido. Deve ser 1 ou 2.' }, { status: 400 });
    }

    const body = await request.json();
    const { image } = body;

    if (!image) {
      return NextResponse.json({ error: 'Nenhuma imagem fornecida.' }, { status: 400 });
    }

    // Save image in-memory
    if (globalRef.cameraFeeds) {
      globalRef.cameraFeeds[id] = {
        image,
        timestamp: Date.now()
      };
    }

    // Trigger stream listeners
    if (globalRef.cameraEmitter) {
      globalRef.cameraEmitter.emit('frame', id, image);
    }

    return NextResponse.json({ success: true, timestamp: Date.now() });
  } catch (error) {
    console.error('Erro no upload da câmera:', error);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
