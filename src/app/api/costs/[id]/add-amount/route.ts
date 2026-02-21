import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: costId } = await params;
    const body = await request.json();
    const { amount, notes } = body;

    if (!amount || isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { error: 'Valid amount is required' },
        { status: 400 }
      );
    }

    // Get the existing cost
    const existingCost = await db.branchCost.findUnique({
      where: { id: costId },
      include: {
        branch: {
          select: { id: true, branchName: true },
        },
        costCategory: {
          select: { id: true, name: true, icon: true },
        },
      },
    });

    if (!existingCost) {
      return NextResponse.json(
        { error: 'Cost entry not found' },
        { status: 404 }
      );
    }

    // Calculate new amount
    const newAmount = existingCost.amount + parseFloat(amount);

    // Append new notes to existing notes if provided
    let updatedNotes = existingCost.notes || '';
    if (notes) {
      const timestamp = new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
      updatedNotes = updatedNotes
        ? `${updatedNotes}\n\n---\n${timestamp}: Added ${parseFloat(amount).toFixed(2)} - ${notes}`
        : `${timestamp}: Added ${parseFloat(amount).toFixed(2)} - ${notes}`;
    }

    // Update the cost entry
    const updatedCost = await db.branchCost.update({
      where: { id: costId },
      data: {
        amount: newAmount,
        notes: updatedNotes,
      },
      include: {
        branch: {
          select: { id: true, branchName: true },
        },
        costCategory: {
          select: { id: true, name: true, icon: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      cost: updatedCost,
      newTotal: newAmount,
    });
  } catch (error: any) {
    console.error('Add amount to cost error:', error);
    return NextResponse.json(
      { error: 'Failed to add amount to cost' },
      { status: 500 }
    );
  }
}
