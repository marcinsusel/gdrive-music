import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

function getLocalCacheDir(): string {
  const homeDir = os.homedir();
  const cacheDir = path.join(homeDir, '.gdrive-music');
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  const audioDir = path.join(cacheDir, 'audio');
  if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true });
  }
  return cacheDir;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'status';
    const cacheDir = getLocalCacheDir();
    const audioDir = path.join(cacheDir, 'audio');

    if (action === 'status') {
      const files = fs.readdirSync(audioDir);
      let totalSize = 0;
      for (const file of files) {
        const filePath = path.join(audioDir, file);
        try {
          const stat = fs.statSync(filePath);
          totalSize += stat.size;
        } catch {
          // ignore
        }
      }

      return NextResponse.json({
        available: true,
        directory: cacheDir,
        cachedFilesCount: files.length,
        totalSizeBytes: totalSize,
        totalSizeMb: Math.round(totalSize / (1024 * 1024)),
      });
    }

    if (action === 'get') {
      const trackId = searchParams.get('trackId');
      if (!trackId) {
        return NextResponse.json({ error: 'Missing trackId' }, { status: 400 });
      }

      // Look for trackId file
      const files = fs.readdirSync(audioDir);
      const match = files.find(f => f.startsWith(trackId));
      if (!match) {
        return NextResponse.json({ error: 'Track not found in local cache' }, { status: 404 });
      }

      const filePath = path.join(audioDir, match);
      const fileBuffer = fs.readFileSync(filePath);
      const ext = path.extname(match).replace('.', '');
      const mimeType = ext === 'mp3' ? 'audio/mpeg' : ext === 'flac' ? 'audio/flac' : `audio/${ext}`;

      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': mimeType,
          'Content-Length': fileBuffer.length.toString(),
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const cacheDir = getLocalCacheDir();
    const audioDir = path.join(cacheDir, 'audio');

    const formData = await req.formData();
    const trackId = formData.get('trackId') as string;
    const format = (formData.get('format') as string) || 'mp3';
    const file = formData.get('file') as File;

    if (!trackId || !file) {
      return NextResponse.json({ error: 'Missing trackId or file' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = `${trackId}.${format}`;
    const filePath = path.join(audioDir, fileName);

    fs.writeFileSync(filePath, buffer);

    return NextResponse.json({
      success: true,
      trackId,
      path: filePath,
      size: buffer.length,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to save track' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const trackId = searchParams.get('trackId');
    if (!trackId) {
      return NextResponse.json({ error: 'Missing trackId' }, { status: 400 });
    }

    const cacheDir = getLocalCacheDir();
    const audioDir = path.join(cacheDir, 'audio');
    const files = fs.readdirSync(audioDir);
    const match = files.find(f => f.startsWith(trackId));

    if (match) {
      fs.unlinkSync(path.join(audioDir, match));
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete' }, { status: 500 });
  }
}
