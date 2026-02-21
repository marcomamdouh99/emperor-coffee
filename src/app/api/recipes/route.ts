import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Recipe API with variant support

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const menuItemId = searchParams.get('menuItemId');
    const menuItemVariantId = searchParams.get('menuItemVariantId');

    const recipes = await db.recipe.findMany({
      where: {
        ...(menuItemId && !menuItemVariantId ? { menuItemId, menuItemVariantId: null } : {}),
        ...(menuItemVariantId ? { menuItemVariantId } : {}),
      },
      include: {
        menuItem: {
          select: {
            id: true,
            name: true,
            category: true,
          },
        },
        ingredient: {
          select: {
            id: true,
            name: true,
            unit: true,
          },
        },
        variant: {
          select: {
            id: true,
            variantType: {
              select: {
                name: true,
              },
            },
            variantOption: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        menuItem: {
          name: 'asc',
        },
      },
    });

    return NextResponse.json({ recipes }, { status: 200 });
  } catch (error) {
    console.error('Error fetching recipes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recipes' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { menuItemId, ingredientId, quantityRequired, menuItemVariantId } = body;

    // Check if recipe already exists (including variant)
    const existing = await db.recipe.findFirst({
      where: {
        menuItemId,
        ingredientId,
        menuItemVariantId: menuItemVariantId || null,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Recipe already exists for this menu item, ingredient, and variant combination' },
        { status: 400 }
      );
    }

    // Get ingredient unit
    const ingredient = await db.ingredient.findUnique({
      where: { id: ingredientId },
    });

    if (!ingredient) {
      return NextResponse.json(
        { error: 'Ingredient not found' },
        { status: 404 }
      );
    }

    const recipe = await db.recipe.create({
      data: {
        menuItemId,
        ingredientId,
        quantityRequired: parseFloat(quantityRequired),
        unit: ingredient.unit,
        menuItemVariantId: menuItemVariantId || null,
      },
      include: {
        menuItem: {
          select: {
            id: true,
            name: true,
            category: true,
          },
        },
        ingredient: {
          select: {
            id: true,
            name: true,
            unit: true,
          },
        },
        variant: {
          select: {
            id: true,
            variantType: {
              select: {
                name: true,
              },
            },
            variantOption: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ recipe }, { status: 201 });
  } catch (error) {
    console.error('Error creating recipe:', error);
    return NextResponse.json(
      { error: 'Failed to create recipe' },
      { status: 500 }
    );
  }
}
