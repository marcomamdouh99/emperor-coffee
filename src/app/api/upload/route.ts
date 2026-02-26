import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const type = formData.get('type') as string; // 'category' or 'menu-item'

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!type || !['category', 'menu-item'].includes(type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid type. Must be "category" or "menu-item"' },
        { status: 400 }
      );
    }

    // Validate file type (only images)
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { success: false, error: 'File must be an image' },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: 'File size must be less than 5MB' },
        { status: 400 }
      );
    }

    // Read file as array buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create unique filename
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    const extension = file.name.split('.').pop() || 'jpg';
    const filename = `${type}-${timestamp}-${random}.${extension}`;

    // Create upload directory if it doesn't exist
    const uploadDir = join(process.cwd(), 'public', 'uploads', type);
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // Write file to disk
    const filePath = join(uploadDir, filename);
    await writeFile(filePath, buffer);

    // Return the public URL path
    const publicPath = `/uploads/${type}/${filename}`;

    return NextResponse.json({
      success: true,
      data: {
        path: publicPath,
        filename,
        size: file.size,
        type: file.type,
      },
    });
  } catch (error: any) {
    console.error('[Upload Error]', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to upload file' },
      { status: 500 }
    );
  }
}
