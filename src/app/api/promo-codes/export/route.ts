import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/promo-codes/export - Export promo codes to CSV
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const promotionId = searchParams.get('promotionId');
    const campaignName = searchParams.get('campaignName');

    const where: any = {};
    if (promotionId) {
      where.promotionId = promotionId;
    }
    if (campaignName) {
      where.campaignName = campaignName;
    }

    const promoCodes = await db.promotionCode.findMany({
      where,
      include: {
        promotion: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (promoCodes.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No promo codes found to export' },
        { status: 404 }
      );
    }

    // Generate CSV content
    const headers = ['Code', 'Campaign Name', 'Promotion Name', 'Discount Type', 'Discount Value', 'Status', 'Usage Count', 'Max Uses', 'Created At'];
    const rows = promoCodes.map((pc) => [
      pc.code,
      pc.campaignName || '',
      pc.promotion.name,
      pc.promotion.discountType,
      pc.promotion.discountValue,
      pc.isActive ? 'Active' : 'Inactive',
      pc.usageCount,
      pc.maxUses || 'Unlimited',
      pc.createdAt.toISOString(),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    // Create response with CSV content
    const response = new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="promo-codes-${Date.now()}.csv"`,
      },
    });

    return response;
  } catch (error) {
    console.error('Error exporting promo codes:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to export promo codes' },
      { status: 500 }
    );
  }
}
