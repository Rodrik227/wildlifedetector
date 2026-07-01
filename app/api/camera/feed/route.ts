import { NextRequest, NextResponse } from 'next/server';

const globalRef = global as unknown as {
  cameraFeeds?: {
    [key: string]: {
      image: string;
      timestamp: number;
    }
  }
};

if (!globalRef.cameraFeeds) {
  globalRef.cameraFeeds = {
    '1': { image: '', timestamp: 0 },
    '2': { image: '', timestamp: 0 }
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id || (id !== '1' && id !== '2')) {
      return NextResponse.json({ error: 'ID de câmera inválido. Deve ser 1 ou 2.' }, { status: 400 });
    }

    const feed = globalRef.cameraFeeds?.[id] || { image: '', timestamp: 0 };

    return NextResponse.json(feed);
  } catch (error) {
    console.error('Erro ao ler feed da câmera:', error);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}
export const dynamic = 'force-dynamic';
